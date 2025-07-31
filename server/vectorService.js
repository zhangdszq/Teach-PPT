const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

/**
 * 向量服务模块 - 使用Pinecone云向量数据库
 */
class VectorService {
  constructor() {
    // OpenAI向量化服务
    this.embeddingAPI = 'https://api.ezai88.com/v1/embeddings';
    this.openaiApiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key';
    
    // Pinecone配置
    this.pineconeApiKey = process.env.PINECONE_API_KEY || 'your-pinecone-api-key';
    this.indexName = 'ppt-templates';
    
    this.pinecone = null;
    this.index = null;
    this.initialized = false;
    
    // 内存存储作为降级方案
    this.vectorStore = new Map();
    this.useMemoryFallback = false;
  }

  /**
   * 初始化Pinecone服务
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🚀 Pinecone向量服务初始化中...');
    
    try {
      // 检查API密钥
      if (!this.pineconeApiKey || this.pineconeApiKey === 'your-pinecone-api-key') {
        throw new Error('Pinecone API密钥未配置');
      }
      
      // 初始化Pinecone客户端
      this.pinecone = new Pinecone({
        apiKey: this.pineconeApiKey,
      });
      
      // 检查索引是否存在
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);
      
      if (!indexExists) {
        console.log(`📋 创建Pinecone索引: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding维度
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // 等待索引创建完成
        console.log('⏳ 等待索引创建完成...');
        await this.waitForIndexReady();
      }
      
      // 获取索引实例
      this.index = this.pinecone.index(this.indexName);
      
      console.log('✅ Pinecone连接成功');
      
    } catch (error) {
      console.error('❌ Pinecone初始化失败:', error.message);
      console.warn('⚠️ 将使用内存模式作为降级方案');
      this.useMemoryFallback = true;
    }
    
    // 预加载示例模板向量
    await this.loadSampleVectors();
    
    this.initialized = true;
    console.log('✅ 向量服务初始化完成');
  }

  /**
   * 等待索引准备就绪
   */
  async waitForIndexReady() {
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.pinecone.describeIndex(this.indexName);
        if (indexStats.status?.ready) {
          console.log('✅ 索引创建完成');
          return;
        }
      } catch (error) {
        // 索引可能还在创建中
      }
      
      attempts++;
      console.log(`⏳ 等待索引就绪... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('索引创建超时');
  }

  /**
   * 文本向量化 - 使用OpenAI API
   */
  async getTextEmbedding(text) {
    // 检查API密钥
    if (!this.openaiApiKey || this.openaiApiKey === 'your-openai-api-key') {
      throw new Error('OpenAI API密钥未配置');
    }

    try {
      const response = await axios.post(this.embeddingAPI, {
        model: 'text-embedding-ada-002',
        input: text,
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30秒超时
      });

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('❌ 向量化失败:', error.message);
      throw new Error(`向量化失败: ${error.message}`);
    }
  }


  /**
   * 计算余弦相似度（内存模式使用）
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 预处理文本
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留中英文和数字
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 提取模板特征文本
   */
  extractTemplateFeatures(template) {
    // 1. 提取基本文本特征
    const features = {
      title: template.title || '',
      description: template.description || '',
      tags: Array.isArray(template.tags) ? template.tags.join(' ') : '',
      subject: template.subject || '',
      grade: template.grade || ''
    };

    // 2. 提取结构化特征并转换为文本
    let structureText = '';
    if (template.structure_summary) {
      const summary = template.structure_summary;
      const elementDescriptions = [];
      if (summary.elements && summary.elements.length > 0) {
        summary.elements.forEach(el => {
          // 将类型翻译成更自然的语言
          const typeMap = {
            'vocab_item': '词汇项目',
            'sentence_frame': '句型框架',
            'image': '图片',
            'title': '标题'
          };
          const typeName = typeMap[el.type] || el.type;
          elementDescriptions.push(`包含${el.count}个${typeName}`);
        });
      }
      if (summary.layout_type) {
        elementDescriptions.push(`布局为${summary.layout_type}`);
      }
      structureText = elementDescriptions.join('，');
    }

    // 3. 提取幻灯片中的具体内容文本（作为补充）
    const contentText = this.extractSlideContent(template.slides || []);

    // 4. 合并所有文本特征，优先考虑结构和描述
    const combinedText = [
      features.title,
      features.description,
      features.tags,
      structureText, // 将结构化描述加入
      features.subject,
      features.grade,
      contentText // 内容作为辅助信息
    ].filter(text => text).join(' ');

    return this.preprocessText(combinedText);
  }

  /**
   * 提取幻灯片内容
   */
  extractSlideContent(slides) {
    return slides.map(slide => {
      if (!slide.elements) return '';
      
      return slide.elements
        .filter(el => el.type === 'text' && el.content)
        .map(el => el.content)
        .join(' ');
    }).join(' ');
  }

  /**
   * 添加模板到向量存储
   */
  async addTemplate(template) {
    try {
      if (!template.id) {
        throw new Error('模板ID不能为空');
      }

      // 提取特征文本
      const featureText = this.extractTemplateFeatures(template);
      
      // 生成向量
      const embedding = await this.getTextEmbedding(featureText);
      
      const metadata = {
        title: template.title || '',
        description: template.description || '',
        tags: template.tags || [],
        subject: template.subject || '',
        grade: template.grade || '',
        createdAt: new Date().toISOString(),
        featureText
      };
      
      if (!this.useMemoryFallback && this.index) {
        // 使用Pinecone存储
        await this.index.upsert([{
          id: template.id,
          values: embedding,
          metadata: metadata
        }]);
        console.log(`✅ 模板 ${template.id} 已存储到Pinecone`);
      } else {
        // 降级到内存存储
        this.vectorStore.set(template.id, {
          id: template.id,
          embedding,
          metadata
        });
        console.log(`✅ 模板 ${template.id} 已存储到内存`);
      }

      return true;
    } catch (error) {
      console.error(`❌ 模板 ${template.id} 向量化失败:`, error.message);
      return false;
    }
  }

  /**
   * 批量添加模板
   */
  async addTemplates(templates) {
    const results = [];
    
    for (const template of templates) {
      const success = await this.addTemplate(template);
      results.push({ id: template.id, success });
      
      // 避免API限流
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * 搜索相似模板
   */
  async searchSimilarTemplates(query, options = {}) {
    const {
      topK = 10,
      threshold = 0.6,
      filters = {}
    } = options;

    try {
      // 预处理查询文本
      const cleanQuery = this.preprocessText(query);
      
      // 生成查询向量
      const queryEmbedding = await this.getTextEmbedding(cleanQuery);
      
      if (!this.useMemoryFallback && this.index) {
        // 使用Pinecone搜索
        const pineconeFilter = this.buildPineconeFilter(filters);
        
        const searchResponse = await this.index.query({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
          filter: pineconeFilter
        });

        // 过滤低相似度结果
        const results = searchResponse.matches
          .filter(match => match.score >= threshold)
          .map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata
          }));

        return {
          query: cleanQuery,
          results,
          total: results.length,
          searchTime: Date.now(),
          storage: 'pinecone'
        };
      } else {
        // 降级到内存搜索
        return this.searchInMemory(queryEmbedding, cleanQuery, topK, threshold, filters);
      }
    } catch (error) {
      console.error('向量搜索失败:', error);
      // 如果Pinecone搜索失败，尝试内存搜索
      if (!this.useMemoryFallback) {
        console.warn('⚠️ Pinecone搜索失败，降级到内存搜索');
        const queryEmbedding = await this.getTextEmbedding(this.preprocessText(query));
        return this.searchInMemory(queryEmbedding, this.preprocessText(query), topK, threshold, filters);
      }
      throw error;
    }
  }

  /**
   * 构建Pinecone过滤条件
   */
  buildPineconeFilter(filters) {
    const filter = {};
    
    if (filters.subject) {
      filter.subject = { $eq: filters.subject };
    }
    
    if (filters.grade) {
      filter.grade = { $eq: filters.grade };
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filter.tags = { $in: filters.tags };
    }
    
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  /**
   * 内存搜索（降级方案）
   */
  searchInMemory(queryEmbedding, cleanQuery, topK, threshold, filters) {
    const similarities = [];
    
    for (const [id, vectorData] of this.vectorStore) {
      // 应用过滤条件
      if (!this.matchesFilters(vectorData.metadata, filters)) {
        continue;
      }
      
      const similarity = this.cosineSimilarity(queryEmbedding, vectorData.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          id,
          score: similarity,
          metadata: vectorData.metadata
        });
      }
    }
    
    // 按相似度排序并返回topK结果
    const results = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      query: cleanQuery,
      results,
      total: results.length,
      searchTime: Date.now(),
      storage: 'memory'
    };
  }

  /**
   * 检查是否匹配过滤条件
   */
  matchesFilters(metadata, filters) {
    if (filters.subject && metadata.subject !== filters.subject) {
      return false;
    }
    
    if (filters.grade && metadata.grade !== filters.grade) {
      return false;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const metadataTags = metadata.tags || [];
      const hasMatchingTag = filters.tags.some(tag => 
        metadataTags.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 加载示例向量数据
   */
  async loadSampleVectors() {
    console.log('📚 开始加载示例向量数据...');
    
    const sampleTemplates = [
      {
        id: 'template_english_alphabet',
        title: '英语字母学习',
        description: '26个英语字母的认知和发音练习',
        tags: ['字母', '发音', '基础'],
        subject: '英语',
        grade: '幼儿园',
        slides: [
          {
            elements: [
              { type: 'text', content: '字母A的学习 Apple 苹果' },
              { type: 'text', content: '字母B的学习 Ball 球' }
            ]
          }
        ]
      },
      {
        id: 'template_phonics',
        title: '自然拼读入门',
        description: '英语自然拼读法基础教学',
        tags: ['拼读', '语音', '发音'],
        subject: '英语',
        grade: '小学',
        slides: [
          {
            elements: [
              { type: 'text', content: 'cat hat bat 相同韵律练习' },
              { type: 'text', content: 'CVC单词拼读规律' }
            ]
          }
        ]
      },
      {
        id: 'template_vocabulary',
        title: '英语单词卡片',
        description: '常用英语单词的图片卡片教学',
        tags: ['单词', '词汇', '卡片'],
        subject: '英语',
        grade: '小学',
        slides: [
          {
            elements: [
              { type: 'text', content: '动物单词：dog cat bird fish' },
              { type: 'text', content: '颜色单词：red blue green yellow' }
            ]
          }
        ]
      },
      {
        id: 'template_conversation',
        title: '英语对话练习',
        description: '日常英语对话情景练习',
        tags: ['对话', '口语', '交流'],
        subject: '英语',
        grade: '中学',
        slides: [
          {
            elements: [
              { type: 'text', content: 'Hello, how are you? I am fine, thank you.' },
              { type: 'text', content: 'What is your name? My name is...' }
            ]
          }
        ]
      },
      {
        id: 'template_grammar',
        title: '英语语法基础',
        description: '英语基础语法规则教学',
        tags: ['语法', '规则', '句型'],
        subject: '英语',
        grade: '中学',
        slides: [
          {
            elements: [
              { type: 'text', content: '现在时态：I am, You are, He/She is' },
              { type: 'text', content: '疑问句：What, Where, When, How' }
            ]
          }
        ]
      }
    ];

    try {
      // 批量添加示例模板，但不让错误阻止初始化
      const results = await this.addTemplates(sampleTemplates);
      const successCount = results.filter(r => r.success).length;
      console.log(`📚 加载了 ${successCount}/${sampleTemplates.length} 个示例模板向量`);
    } catch (error) {
      console.warn('⚠️ 加载示例向量数据时出现错误，但不影响服务启动:', error.message);
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      if (!this.useMemoryFallback && this.index) {
        // 获取Pinecone索引统计
        const indexStats = await this.index.describeIndexStats();
        return {
          totalVectors: indexStats.totalVectorCount || 0,
          initialized: this.initialized,
          storage: 'pinecone',
          indexName: this.indexName,
          dimension: indexStats.dimension || 1536,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        };
      } else {
        // 内存模式统计
        return {
          totalVectors: this.vectorStore?.size || 0,
          initialized: this.initialized,
          storage: 'memory',
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        };
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        totalVectors: 0,
        initialized: this.initialized,
        storage: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * 清空向量存储
   */
  async clear() {
    try {
      if (!this.useMemoryFallback && this.index) {
        // 删除Pinecone索引中的所有向量
        console.log('🗑️ 清空Pinecone索引...');
        
        // 获取所有向量ID
        const listResponse = await this.index.listPaginated();
        if (listResponse.vectors && listResponse.vectors.length > 0) {
          const vectorIds = listResponse.vectors.map(v => v.id);
          await this.index.deleteMany(vectorIds);
        }
        
        console.log('✅ Pinecone索引已清空');
      } else {
        // 清空内存存储
        this.vectorStore?.clear();
        console.log('✅ 内存向量存储已清空');
      }
    } catch (error) {
      console.error('清空向量存储失败:', error);
      throw error;
    }
  }
}

module.exports = new VectorService();
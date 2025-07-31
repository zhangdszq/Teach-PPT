const vectorService = require('./vectorService');

/**
 * 设置向量API路由
 */
function setupVectorAPI(app) {
  
  // 搜索相似模板
  app.post('/api/vector/search', async (req, res) => {
    try {
      const { query, topK = 10, threshold = 0.6, filters = {} } = req.body;
      
      if (!query) {
        return res.status(400).json({
          status: 'error',
          message: '查询内容不能为空'
        });
      }
      
      console.log(`🔍 向量搜索: "${query}"`);
      
      const results = await vectorService.searchSimilarTemplates(query, {
        topK,
        threshold,
        filters
      });
      
      res.json({
        status: 'success',
        data: results
      });
      
    } catch (error) {
      console.error('向量搜索API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '搜索失败，请稍后重试',
        error: error.message
      });
    }
  });

  // 添加单个模板到向量索引
  app.post('/api/vector/index', async (req, res) => {
    try {
      const { template } = req.body;
      
      if (!template || !template.id) {
        return res.status(400).json({
          status: 'error',
          message: '模板数据不完整'
        });
      }
      
      console.log(`📝 添加模板到向量索引: ${template.id}`);
      
      const success = await vectorService.addTemplate(template);
      
      if (success) {
        res.json({
          status: 'success',
          message: '模板已成功添加到向量索引',
          templateId: template.id
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: '模板添加失败'
        });
      }
      
    } catch (error) {
      console.error('添加模板API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '添加模板失败，请稍后重试',
        error: error.message
      });
    }
  });

  // 批量添加模板到向量索引
  app.post('/api/vector/batch-index', async (req, res) => {
    try {
      const { templates } = req.body;
      
      if (!Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: '模板列表不能为空'
        });
      }
      
      console.log(`📚 批量添加 ${templates.length} 个模板到向量索引`);
      
      const results = await vectorService.addTemplates(templates);
      const successCount = results.filter(r => r.success).length;
      
      res.json({
        status: 'success',
        message: `成功添加 ${successCount}/${templates.length} 个模板`,
        results
      });
      
    } catch (error) {
      console.error('批量添加模板API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '批量添加失败，请稍后重试',
        error: error.message
      });
    }
  });

  // 获取向量服务统计信息
  app.get('/api/vector/stats', async (req, res) => {
    try {
      console.log('📊 获取向量服务统计信息');
      
      const stats = await vectorService.getStats();
      
      res.json({
        status: 'success',
        data: stats
      });
      
    } catch (error) {
      console.error('获取统计信息API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '获取统计信息失败',
        error: error.message
      });
    }
  });

  // 清空向量存储（仅开发环境）
  app.delete('/api/vector/clear', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          status: 'error',
          message: '生产环境不允许清空向量存储'
        });
      }
      
      console.log('🗑️ 清空向量存储');
      
      await vectorService.clear();
      
      res.json({
        status: 'success',
        message: '向量存储已清空'
      });
      
    } catch (error) {
      console.error('清空向量存储API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '清空失败，请稍后重试',
        error: error.message
      });
    }
  });

  // 智能模板推荐
  app.post('/api/vector/recommend', async (req, res) => {
    try {
      const { 
        userInput, 
        subject, 
        grade, 
        limit = 5,
        threshold = 0.5 
      } = req.body;
      
      if (!userInput) {
        return res.status(400).json({
          status: 'error',
          message: '用户输入不能为空'
        });
      }
      
      console.log(`🎯 智能推荐: "${userInput}" (${subject}, ${grade})`);
      
      // 构建查询文本
      let query = userInput;
      if (subject) query += ` ${subject}`;
      if (grade) query += ` ${grade}`;
      
      // 构建过滤条件
      const filters = {};
      if (subject) filters.subject = subject;
      if (grade) filters.grade = grade;
      
      const results = await vectorService.searchSimilarTemplates(query, {
        topK: limit,
        threshold,
        filters
      });
      
      // 为推荐结果添加推荐理由
      const recommendations = results.results.map(result => ({
        ...result,
        reason: generateRecommendationReason(result, userInput, subject, grade)
      }));
      
      res.json({
        status: 'success',
        data: {
          ...results,
          results: recommendations,
          userInput,
          filters: { subject, grade }
        }
      });
      
    } catch (error) {
      console.error('智能推荐API错误:', error);
      res.status(500).json({
        status: 'error',
        message: '推荐失败，请稍后重试',
        error: error.message
      });
    }
  });

  // 生成推荐理由
  function generateRecommendationReason(result, userInput, subject, grade) {
    const reasons = [];
    
    if (result.score > 0.8) {
      reasons.push('高度匹配您的需求');
    } else if (result.score > 0.7) {
      reasons.push('较好匹配您的需求');
    } else {
      reasons.push('部分匹配您的需求');
    }
    
    if (result.metadata.subject === subject) {
      reasons.push(`适合${subject}教学`);
    }
    
    if (result.metadata.grade === grade) {
      reasons.push(`适合${grade}学生`);
    }
    
    if (result.metadata.tags && result.metadata.tags.length > 0) {
      const matchingTags = result.metadata.tags.filter(tag => 
        userInput.includes(tag)
      );
      if (matchingTags.length > 0) {
        reasons.push(`包含相关标签: ${matchingTags.join(', ')}`);
      }
    }
    
    return reasons.join('；');
  }

  console.log('✅ 向量API路由设置完成');
}

module.exports = { setupVectorAPI };
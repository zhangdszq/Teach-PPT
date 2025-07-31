const axios = require('axios');

// 定义一个具有精确结构描述的模板
const structuralTemplate = {
  id: 'layout_vocab_sentence_drill_v1',
  title: '词汇与句型练习模板',
  description: '一个两栏模板，左侧用于图文词汇展示，右侧用于句型填空练习。非常适合新单词和基本语法的教学场景。',
  tags: ['词汇学习', '句型练习', '看图识词', '填空题', '模板布局', '教学设计'],
  subject: '通用',
  grade: '通用',
  // 新增的结构化描述字段
  structure_summary: {
    elements: [
      { type: 'vocab_item', count: 5 },
      { type: 'sentence_frame', count: 2 }
    ],
    layout_type: 'two_column'
  },
  slides: [] // 具体内容在此次测试中不重要
};

async function testStructuralSearch() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 开始结构化搜索测试...');
  
  try {
    // 1. 添加结构化模板到向量索引
    console.log(`1. 正在添加结构化模板: ${structuralTemplate.id}`);
    const indexResponse = await axios.post(`${baseURL}/api/vector/index`, {
      template: structuralTemplate
    });
    console.log('✅ 添加成功:', indexResponse.data.message);
    
    // 2. 等待5秒，确保索引更新
    console.log('⏳ 等待5秒让Pinecone更新索引...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. 使用精确的结构化查询进行搜索
    const searchQuery = '找一个包含5个词汇项目和2个句型框架的模板';
    console.log(`3. 正在进行结构化搜索: "${searchQuery}"`);
    const searchResponse = await axios.post(`${baseURL}/api/vector/search`, {
      query: searchQuery,
      topK: 1
    });
    
    const results = searchResponse.data.data.results;
    if (results && results.length > 0 && results[0].id === structuralTemplate.id) {
      console.log('✅ 结构化搜索成功！已精确匹配到模板。');
      console.log('📄 匹配结果:', JSON.stringify(results[0], null, 2));
    } else {
      console.error('❌ 结构化搜索失败！未能匹配到模板。');
      console.error('📄 搜索返回:', JSON.stringify(searchResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testStructuralSearch();

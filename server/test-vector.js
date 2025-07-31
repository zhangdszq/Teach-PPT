const axios = require('axios');

async function testVectorService() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 测试向量服务...');
  
  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ 健康检查通过:', healthResponse.data.message);
    
    // 2. 测试向量搜索
    console.log('2. 测试向量搜索...');
    const searchResponse = await axios.post(`${baseURL}/api/vector/search`, {
      query: '英语字母学习',
      topK: 3,
      threshold: 0.3
    });
    console.log('✅ 向量搜索结果:', JSON.stringify(searchResponse.data, null, 2));
    
    // 3. 测试统计信息
    console.log('3. 测试统计信息...');
    const statsResponse = await axios.get(`${baseURL}/api/vector/stats`);
    console.log('✅ 统计信息:', JSON.stringify(statsResponse.data, null, 2));
    
    // 4. 测试智能推荐
    console.log('4. 测试智能推荐...');
    const recommendResponse = await axios.post(`${baseURL}/api/vector/recommend`, {
      userInput: '我想教孩子学习英语字母',
      subject: '英语',
      grade: '幼儿园',
      limit: 3
    });
    console.log('✅ 智能推荐结果:', JSON.stringify(recommendResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 等待服务器启动后再测试
setTimeout(testVectorService, 3000);
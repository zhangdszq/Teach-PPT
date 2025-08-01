const axios = require('axios');

// 测试生成PPT接口
async function testGeneratePPT() {
    try {
        console.log('🧪 开始测试PPT生成接口...');
        
        console.log('⏳ 等待5秒让服务器重启...');
        await new Promise(resolve => setTimeout(resolve, 5000));

                // 使用课程大纲模板的内容作为测试数据
        const testData = {
            content: `

---


#### 🖼️ 教学页面 3：字母A开头单词

* 图卡：**A is for Apple, Ant, Alligator**
* 读音练习：**/æ/ - p - l (apple)**，强调首音 /æ/

---
            `,
            language: "中文",
            model: "GLM-4-Flash",
            style: "儿童友好",
            stream: true
        };

        console.log('📤 发送请求到服务器...');
        console.log('请求数据:', {
            content: testData.content,
        });

        const response = await axios.post('http://localhost:3001/api/ai/ppt', testData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60秒超时
        });

        console.log('✅ 请求成功！');
        console.log('响应状态:', response.status);
        
        if (response.data && response.data.status === 'success') {
            const result = response.data.data;
            console.log('\n📊 PPT生成结果:');
            console.log(JSON.stringify(result, null, 2));

            if (result.some(slide => slide.title && slide.title.includes('默认'))) {
                console.error('❌ 测试失败: 返回了默认幻灯片');
            } else {
                console.log('\n🎉 PPT生成测试成功！');
            }
            
            // 保存结果到文件以便查看
            const fs = require('fs');
            fs.writeFileSync('generated-ppt-result.json', JSON.stringify(result, null, 2), 'utf8');
            console.log('📁 完整结果已保存到 generated-ppt-result.json');
            
        } else {
            console.error('❌ 服务器返回错误:', response.data);
        }

    } catch (error) {
        console.error('❌ 测试失败:');
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        } else if (error.request) {
            console.error('请求超时或网络错误');
            console.error('请确保服务器正在运行在 http://localhost:3001');
        } else {
            console.error('错误信息:', error.message);
        }
    }
}

// 运行测试
testGeneratePPT();
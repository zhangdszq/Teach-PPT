const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 火山引擎视觉服务类
class VolcengineVisualService {
  constructor() {
    this.accessKey = process.env.VOLC_AK;
    this.secretKey = process.env.VOLC_SK;
    this.region = 'cn-north-1';
    this.service = 'cv';
    this.host = 'visual.volcengineapi.com';
    this.endpoint = 'https://visual.volcengineapi.com';
    this.method = 'POST';
  }

  // 签名函数
  sign(key, msg) {
    return crypto.createHmac('sha256', key).update(msg, 'utf8').digest();
  }

  // 获取签名密钥
  getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = this.sign(key, dateStamp);
    const kRegion = this.sign(kDate, regionName);
    const kService = this.sign(kRegion, serviceName);
    const kSigning = this.sign(kService, 'request');
    return kSigning;
  }

  // 格式化查询参数
  formatQuery(parameters) {
    let requestParameters = '';
    const sortedKeys = Object.keys(parameters).sort();
    for (const key of sortedKeys) {
      requestParameters += key + '=' + parameters[key] + '&';
    }
    return requestParameters.slice(0, -1);
  }

  // V4签名请求
  signV4Request(reqQuery, reqBody) {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('No access key is available.');
    }

    const t = new Date();
    const currentDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const datestamp = currentDate.substr(0, 8);

    const canonicalUri = '/';
    const canonicalQuerystring = reqQuery;
    const signedHeaders = 'content-type;host;x-content-sha256;x-date';
    const payloadHash = crypto.createHash('sha256').update(reqBody, 'utf8').digest('hex');
    const contentType = 'application/json';

    const canonicalHeaders = 
      'content-type:' + contentType + '\n' +
      'host:' + this.host + '\n' +
      'x-content-sha256:' + payloadHash + '\n' +
      'x-date:' + currentDate + '\n';

    const canonicalRequest = 
      this.method + '\n' +
      canonicalUri + '\n' +
      canonicalQuerystring + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      payloadHash;

    const algorithm = 'HMAC-SHA256';
    const credentialScope = datestamp + '/' + this.region + '/' + this.service + '/' + 'request';
    const stringToSign = 
      algorithm + '\n' +
      currentDate + '\n' +
      credentialScope + '\n' +
      crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

    const signingKey = this.getSignatureKey(this.secretKey, datestamp, this.region, this.service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const authorizationHeader = 
      algorithm + ' ' +
      'Credential=' + this.accessKey + '/' + credentialScope + ', ' +
      'SignedHeaders=' + signedHeaders + ', ' +
      'Signature=' + signature;

    const headers = {
      'X-Date': currentDate,
      'Authorization': authorizationHeader,
      'X-Content-Sha256': payloadHash,
      'Content-Type': contentType
    };

    const requestUrl = this.endpoint + '?' + canonicalQuerystring;

    return { requestUrl, headers };
  }

  // CV处理接口
  async cvProcess(form) {
    try {
      if (!this.accessKey || !this.secretKey) {
        throw new Error('火山引擎API密钥未配置');
      }

      console.log('🔥 使用火山引擎JavaScript SDK调用API...');
      console.log('📝 请求参数:', JSON.stringify(form, null, 2));

      // 请求Query参数
      const queryParams = {
        'Action': 'CVProcess',
        'Version': '2022-08-31'
      };
      const formattedQuery = this.formatQuery(queryParams);

      // 请求Body参数
      const bodyParams = {
        req_key: form.req_key,
        prompt: form.prompt,
        return_url: form.return_url || true
      };
      const formattedBody = JSON.stringify(bodyParams);

      console.log('🔗 查询参数:', formattedQuery);
      console.log('📄 请求体:', formattedBody);

      // 生成签名和请求头
      const { requestUrl, headers } = this.signV4Request(formattedQuery, formattedBody);

      console.log('⚡ 正在调用火山引擎API...');
      console.log('🌐 请求URL:', requestUrl);

      // 发送请求
      const response = await axios({
        method: 'POST',
        url: requestUrl,
        headers: headers,
        data: formattedBody,
        timeout: 60000
      });

      console.log('📡 火山引擎API响应状态:', response.status);
      
      // 处理响应
      let respStr = JSON.stringify(response.data).replace(/\\u0026/g, '&');
      const responseData = JSON.parse(respStr);
      
      console.log('📄 火山引擎API响应数据:', JSON.stringify(responseData, null, 2));

      // 检查响应格式
      if (responseData && responseData.data && responseData.data.image_urls && responseData.data.image_urls.length > 0) {
        console.log('✅ 火山引擎API调用成功');
        console.log('🖼️ 生成的图片URL:', responseData.data.image_urls[0]);
        return responseData;
      } else if (responseData.ResponseMetadata && responseData.ResponseMetadata.Error) {
        const error = responseData.ResponseMetadata.Error;
        console.error('❌ 火山引擎API返回错误:', error.Message);
        throw new Error(`火山引擎API错误: ${error.Message} (Code: ${error.Code})`);
      } else {
        console.error('❌ 火山引擎API响应格式异常');
        console.error('📄 完整响应:', JSON.stringify(responseData, null, 2));
        throw new Error('响应中未找到图片URL');
      }

    } catch (error) {
      console.error('❌ 火山引擎API调用失败:', error.message);
      if (error.response) {
        console.error('📄 错误响应状态:', error.response.status);
        console.error('📄 错误响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
}

// 生成图片函数
async function generateImageFromText(sentence) {
  console.log('🎨 开始生成图片...');
  console.log('📄 输入句子:', sentence);

  // 调试环境变量
  console.log('🔍 调试环境变量:');
  console.log('🔍 process.env.VOLC_AK:', process.env.VOLC_AK ? 'exists' : 'not found');
  console.log('🔍 process.env.VOLC_SK:', process.env.VOLC_SK ? 'exists' : 'not found');
  console.log('🔍 所有环境变量:', Object.keys(process.env).filter(key => key.startsWith('VOLC')));

  const visualService = new VolcengineVisualService();

  const ak = process.env.VOLC_AK;
  const sk = process.env.VOLC_SK;

  if (!ak || !sk) {
    console.error('❌ 火山引擎API密钥未配置');
    console.error('❌ VOLC_AK:', ak || '未设置');
    console.error('❌ VOLC_SK:', sk || '未设置');
    return {
      status: "error",
      error_message: "火山引擎API密钥 (VOLC_AK, VOLC_SK) 未在环境变量中设置"
    };
  }

  console.log('🔑 使用环境变量中的API密钥');
  console.log('🔑 VOLC_AK:', ak ? ak.substring(0, 8) + '...' : '未设置');
  console.log('🔑 VOLC_SK:', sk ? sk.substring(0, 8) + '...' : '未设置');

  const form = {
    req_key: "jimeng_high_aes_general_v21_L",
    prompt: `${sentence}. 精准帮我根据例句生成图片,风格一直为卡通，注意，一定图中不能有文字！, 图片主体要和例句单复数保持一致`,
    return_url: true
  };

  try {
    console.log('🚀 调用火山引擎视觉服务...');
    const resp = await visualService.cvProcess(form);
    
    if (resp.data && resp.data.image_urls && resp.data.image_urls.length > 0) {
      console.log('🎉 图片生成成功!');
      return {
        status: "success", 
        image_url: resp.data.image_urls[0]
      };
    } else {
      console.error('❌ 响应中未找到图片URL');
      return {
        status: "error", 
        error_message: "响应中未找到图片URL"
      };
    }
  } catch (error) {
    console.error('💥 图片生成异常:', error.message);
    return {
      status: "error", 
      error_message: error.message
    };
  }
}

// AI图片生成服务
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, model = 'jimeng' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        error_message: '请提供图片描述'
      });
    }

    console.log(`正在生成图片: ${prompt}, 模型: ${model}`);
    
    if (model === 'jimeng') {
      // 使用真实的火山引擎即梦服务
      const result = await generateImageFromText(prompt);
      res.json(result);
    } else {
      // 其他模型暂时使用模拟服务
      const mockImageUrl = generateMockImage(prompt);
      res.json({
        success: true,
        data: {
          url: mockImageUrl,
          prompt: prompt,
          model: model
        }
      });
    }
    
  } catch (error) {
    console.error('图片生成错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: '图片生成失败，请稍后重试'
    });
  }
});

// 生成模拟图片URL的函数（用于非即梦模型）
function generateMockImage(prompt) {
  const width = 800;
  const height = 600;
  const seed = encodeURIComponent(prompt).slice(0, 20);
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PPTist AI图片生成服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 获取支持的模型列表
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: 'jimeng',
        name: '即梦 (火山引擎)',
        description: '专业的卡通风格图片生成',
        recommended: true
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'OpenAI最新图片生成模型'
      },
      {
        id: 'stable-diffusion',
        name: 'Stable Diffusion',
        description: '开源图片生成模型'
      }
    ]
  });
});

// 获取测试图片数据接口
app.get('/api/mock-images', (req, res) => {
  try {
    console.log('📸 获取测试图片数据');
    
    // 生成测试图片数据
    const mockImages = [
      {
        id: 'img_1',
        src: 'https://picsum.photos/seed/apple/400/300',
        width: 400,
        height: 300
      },
      {
        id: 'img_2', 
        src: 'https://picsum.photos/seed/book/500/400',
        width: 500,
        height: 400
      },
      {
        id: 'img_3',
        src: 'https://picsum.photos/seed/cat/300/300',
        width: 300,
        height: 300
      },
      {
        id: 'img_4',
        src: 'https://picsum.photos/seed/dog/600/400',
        width: 600,
        height: 400
      },
      {
        id: 'img_5',
        src: 'https://picsum.photos/seed/flower/400/600',
        width: 400,
        height: 600
      },
      {
        id: 'img_6',
        src: 'https://picsum.photos/seed/tree/500/300',
        width: 500,
        height: 300
      }
    ];
    
    console.log(`✅ 返回${mockImages.length}张测试图片`);
    res.json(mockImages);
    
  } catch (error) {
    console.error('获取测试图片数据错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: '获取测试图片数据失败'
    });
  }
});

// AIPPT大纲生成接口
app.post('/tools/aippt_outline', (req, res) => {
  try {
    const { content, language, model } = req.body;
    
    console.log(`📝 生成AIPPT大纲: ${content}, 语言: ${language}, 模型: ${model}`);
    
    // 模拟流式响应
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // 模拟大纲内容
    const mockOutline = `

---

## 🧠 教学目标（适合3-6岁）

* 认识字母 A / B / C 的大写与小写
* 学会字母发音：/æ/、/b/、/k/
* 理解发音与单词之间的联系（自然拼读意识）
* 初步进行字母音拼读（初级水平）

---

## 📚 教学内容结构（每个字母为一课）

---

### 🌟 **Lesson 1: A a**

#### 📄 教学页面 1：字母形状

* 展示大写和小写：**A a**
* 画面元素：苹果树上挂着“A”、蚂蚁爬过“A”造型
* 指导语：**“This is A. Big A, small a.”**

#### 🔊 教学页面 2：字母音

* 语音演示：**“A says /æ/, /æ/, /æ/.”**
* 音频动画：老师指着“A”，小动物重复发音（apple apple apple）

#### 🖼️ 教学页面 3：字母A开头单词

* 图卡：**A is for Apple, Ant, Alligator**
* 读音练习：**/æ/ - p - l (apple)**，强调首音 /æ/

---

#### 📝 练习页面 A1：字母音辨认

> **What's the sound?**
> 🖼️ 图：apple 🍎 – ball ⚽ – cat 🐱
> 👉 让孩子指出哪个是 /æ/

#### 🧩 练习页面 A2：拼读游戏（听音拖动）

* “Drag the letter to make the word”
* **a - p - p - l - e**（拼读并点亮苹果图）

---

### 🌟 **Lesson 2: B b**

#### 📄 教学页面 1：字母形状

* 展示大写和小写：**B b**
* 画面元素：一只小熊（bear）抱着大写B，小蜜蜂飞出小写b
* 指导语：**“This is B. Big B, small b.”**

#### 🔊 教学页面 2：字母音

* 语音演示：**“B says /b/, /b/, /b/.”**
* 动画口型强调 /b/ 是双唇爆破音

#### 🖼️ 教学页面 3：字母B开头单词

* 图卡：**B is for Bear, Ball, Banana**
* 读音练习：**/b/ - e - a - r (bear)**

---

#### 📝 练习页面 B1：配对游戏

> 连接字母和图片
> **B** → 🐻 🏀 🍌
> **A** → 🍎 🐜 🐊

#### 🧩 练习页面 B2：初级拼读

> 选择正确拼读
> **Which one is b-a-l-l?**
> 选项：ball / bell / bill（配图）

---

### 🌟 **Lesson 3: C c**

#### 📄 教学页面 1：字母形状

* 展示大写和小写：**C c**
* 画面：猫咪 curled like a C，小C变成香蕉月牙
* 指导语：**“This is C. Big C, small c.”**

#### 🔊 教学页面 2：字母音

* 语音演示：**“C says /k/, /k/, /k/.”**
* 动画强调 /k/ 是后舌发音，模拟猫叫 sound

#### 🖼️ 教学页面 3：字母C开头单词

* 图卡：**C is for Cat, Car, Cake**
* 拼读练习：**/k/ - a - t (cat)**

---

#### 📝 练习页面 C1：字母找图

* 点读互动：出现 6 张图，选出以 /k/ 开头的
  例：cat 🐱 / dog 🐶 / cake 🎂 / sun ☀️

#### 🧩 练习页面 C2：拼读听写

* 听音：**“/k/ - a - r”**
* 选图：🚗 / 🍰 / 🐱

---

## 🎮 复习游戏环节（AB C混合）

* **Letter Bingo**：听音点击图卡
* **Sound Hopscotch**：按发音跳格子（/æ/ /b/ /k/）
* **Phonics Song**：ABC字母歌 + 单词串烧

---
`;

    // 模拟流式输出
    const chunks = mockOutline.split('\n');
    let index = 0;
    
    const sendChunk = () => {
      if (index < chunks.length) {
        res.write(chunks[index] + '\n');
        index++;
        setTimeout(sendChunk, 100); // 模拟延迟
      } else {
        res.end();
      }
    };
    
    sendChunk();
    
  } catch (error) {
    console.error('生成大纲错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: '大纲生成失败，请稍后重试'
    });
  }
});

// AIPPT生成接口
app.post('/tools/aippt', (req, res) => {
  try {
    const { content, language, style, model } = req.body;
    
    console.log(`🎨 生成AIPPT: 语言=${language}, 风格=${style}, 模型=${model}`);
    
    // 模拟流式响应
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // 模拟PPT内容
    const mockPPTContent =  {
    type: "content",
    data: {
        title: "F 相关单词",
        items: [
            {
                "title": "Factory",
                "text": "Factory"
            },
            {
                "title": "fish",
                "text": "小鱼在水中游，Ff带来惊喜。"
            },
            {
                "title": "flower",
                "text": "花朵绽放美丽，Ff的温柔象征。"
            }
        ]
    }
}
    
    // 发送JSON数据
    setTimeout(() => {
      res.write(JSON.stringify(mockPPTContent));
      res.end();
    }, 1000);
    
  } catch (error) {
    console.error('生成PPT错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: 'PPT生成失败，请稍后重试'
    });
  }
});

// AI写作接口
app.post('/tools/ai_writing', (req, res) => {
  try {
    const { content, command } = req.body;
    
    console.log(`✍️ AI写作: 命令=${command}, 内容长度=${content.length}`);
    
    // 模拟流式响应
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    let result = '';
    
    // 根据命令生成不同的结果
    switch (command) {
      case '美化改写':
        result = '经过精心美化改写的内容，语言更加优美流畅，表达更加准确生动。';
        break;
      case '扩写丰富':
        result = '在原有内容基础上进行扩写，增加了更多细节描述、背景信息和深入分析，使内容更加丰富完整。';
        break;
      case '精简提炼':
        result = '提炼核心要点，去除冗余信息，保留最重要的内容。';
        break;
      default:
        result = '根据您的要求对内容进行了相应的处理和优化。';
    }
    
    // 模拟流式输出
    const chars = result.split('');
    let index = 0;
    
    const sendChar = () => {
      if (index < chars.length) {
        res.write(chars[index]);
        index++;
        setTimeout(sendChar, 50); // 模拟打字效果
      } else {
        res.end();
      }
    };
    
    sendChar();
    
  } catch (error) {
    console.error('AI写作错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: 'AI写作失败，请稍后重试'
    });
  }
});

// 模板数据存储（实际项目中应该使用数据库）
const templateData = {
  template_1: {
    slides: [
      {
        id: 'slide_1',
        type: 'cover',
        elements: [
          {
            type: 'text',
            id: 'text_1',
            left: 100,
            top: 200,
            width: 760,
            height: 100,
            content: '<p style="text-align: center; font-size: 48px; font-weight: bold; color: #2563eb;">英语字母教学模板</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#2563eb',
            textType: 'title'
          }
        ],
        background: {
          type: 'solid',
          color: '#f8fafc'
        }
      },
      {
        id: 'slide_content_1',
        type: 'content',
        elements: [
          {
            type: 'text',
            id: 'text_content_1',
            left: 100,
            top: 100,
            width: 760,
            height: 60,
            content: '<p style="text-align: center; font-size: 32px; font-weight: bold; color: #1f2937;">内容标题</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#1f2937',
            textType: 'title'
          },
          {
            type: 'text',
            id: 'text_item_1',
            left: 100,
            top: 200,
            width: 350,
            height: 200,
            content: '<p style="font-size: 18px; color: #374151;">内容项目1</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#374151',
            textType: 'item'
          },
          {
            type: 'text',
            id: 'text_item_2',
            left: 500,
            top: 200,
            width: 350,
            height: 200,
            content: '<p style="font-size: 18px; color: #374151;">内容项目2</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#374151',
            textType: 'item'
          }
        ],
        background: {
          type: 'solid',
          color: '#ffffff'
        }
      }
    ],
    theme: {
      backgroundColor: '#ffffff',
      themeColors: [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
      ],
      fontColor: '#1f2937',
      fontName: '微软雅黑'
    }
  },
  template_2: {
    slides: [
      {
        id: 'slide_2',
        type: 'cover',
        elements: [
          {
            type: 'text',
            id: 'text_2',
            left: 100,
            top: 200,
            width: 760,
            height: 100,
            content: '<p style="text-align: center; font-size: 48px; font-weight: bold; color: #059669;">自然拼读教学模板</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#059669',
            textType: 'title'
          }
        ],
        background: {
          type: 'solid',
          color: '#f0fdf4'
        }
      },
      {
        id: 'slide_content_2',
        type: 'content',
        elements: [
          {
            type: 'text',
            id: 'text_content_2',
            left: 100,
            top: 100,
            width: 760,
            height: 60,
            content: '<p style="text-align: center; font-size: 32px; font-weight: bold; color: #1f2937;">拼读内容</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#1f2937',
            textType: 'title'
          },
          {
            type: 'text',
            id: 'text_item_3',
            left: 100,
            top: 200,
            width: 350,
            height: 200,
            content: '<p style="font-size: 18px; color: #374151;">拼读项目1</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#374151',
            textType: 'item'
          },
          {
            type: 'text',
            id: 'text_item_4',
            left: 500,
            top: 200,
            width: 350,
            height: 200,
            content: '<p style="font-size: 18px; color: #374151;">拼读项目2</p>',
            defaultFontName: '微软雅黑',
            defaultColor: '#374151',
            textType: 'item'
          }
        ],
        background: {
          type: 'solid',
          color: '#f0fdf4'
        }
      }
    ],
    theme: {
      backgroundColor: '#ffffff',
      themeColors: [
        '#059669', '#dc2626', '#7c3aed', '#ea580c',
        '#0891b2', '#65a30d', '#c2410c', '#9333ea'
      ],
      fontColor: '#1f2937',
      fontName: '微软雅黑'
    }
  }
};

// 获取模板数据接口
app.get('/api/template/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;
    
    console.log(`📋 获取模板数据: ${templateId}`);
    
    // 特殊处理slides请求，返回默认的初始幻灯片数组
    if (templateId === 'slides') {
      const defaultSlides = [
        {
          id: 'slide_default_1',
          elements: [
            {
              type: 'text',
              id: 'text_default_1',
              left: 100,
              top: 200,
              width: 760,
              height: 100,
              content: '<p style="text-align: center; font-size: 48px; font-weight: bold; color: #2563eb;">欢迎使用 Teach PPT</p>',
              defaultFontName: '微软雅黑',
              defaultColor: '#2563eb'
            },
            {
              type: 'text',
              id: 'text_default_2',
              left: 100,
              top: 320,
              width: 760,
              height: 60,
              content: '<p style="text-align: center; font-size: 24px; color: #64748b;">专为英语教学设计的在线PPT制作工具</p>',
              defaultFontName: '微软雅黑',
              defaultColor: '#64748b'
            }
          ],
          background: {
            type: 'solid',
            color: '#ffffff'
          }
        }
      ];
      
      console.log('✅ 返回默认幻灯片数组，长度:', defaultSlides.length);
      console.log('📋 第一个幻灯片ID:', defaultSlides[0].id);
      console.log('📋 第一个幻灯片元素数量:', defaultSlides[0].elements.length);
      
      // 设置正确的响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      return res.status(200).json(defaultSlides);
    }
    
    if (templateData[templateId]) {
      res.json(templateData[templateId]);
    } else {
      // 返回默认模板
      res.json(templateData.template_1);
    }
    
  } catch (error) {
    console.error('获取模板数据错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: '获取模板数据失败'
    });
  }
});

// 保存PPT模板接口
app.post('/api/save-template', (req, res) => {
  try {
    const { slideData, templateName } = req.body;
    
    if (!slideData) {
      return res.status(400).json({
        status: 'error',
        error_message: '请提供幻灯片数据'
      });
    }

    // 生成模板ID和时间戳
    const templateId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // 构建模板数据
    const templateData = {
      id: templateId,
      name: templateName || `模板_${templateId}`,
      slideData: slideData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    console.log(`📝 保存PPT模板: ${templateData.name}`);
    console.log(`📄 模板数据:`, JSON.stringify(slideData, null, 2));
    
    // 这里可以将模板数据保存到数据库或文件系统
    // 目前先返回成功响应，实际项目中可以集成数据库
    
    res.json({
      status: 'success',
      message: '模板保存成功',
      data: {
        templateId: templateId,
        templateName: templateData.name,
        timestamp: timestamp
      }
    });
    
  } catch (error) {
    console.error('保存模板错误:', error);
    res.status(500).json({
      status: 'error',
      error_message: '模板保存失败，请稍后重试'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PPTist 服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
});
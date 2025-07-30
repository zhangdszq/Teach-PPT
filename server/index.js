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

app.listen(PORT, () => {
  console.log(`🚀 PPTist AI图片生成服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
});
import axios from './config'

// 开发环境使用本地服务器，生产环境使用远程服务器
export const SERVER_URL = (import.meta.env.MODE === 'development') ? 'http://localhost:3001' : 'https://server.pptist.cn'

export const ASSET_URL = 'https://asset.pptist.cn'

interface AIPPTOutlinePayload {
  content: string
  language: string
  model: string
}

interface AIPPTPayload {
  content: string
  language: string
  style: string
  model: string
}

interface AIWritingPayload {
  content: string
  command: string
}

interface AIImagePayload {
  prompt: string
  model?: string
}

export default {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
  },

  getFileData(filename: string): Promise<any> {
    // 使用本地后端服务获取数据
    return axios.get(`${SERVER_URL}/api/template/${filename}`)
  },

  AIPPT_Outline({
    content,
    language,
    model,
  }: AIPPTOutlinePayload): Promise<any> {
    return fetch(`${SERVER_URL}/api/ai/outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        language,
        model,
        stream: true,
      }),
    })
  },

  AIPPT({
    content,
    language,
    style,
    model,
  }: AIPPTPayload): Promise<any> {
    return fetch(`${SERVER_URL}/api/ai/aippt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        language,
        model,
        style,
        stream: true,
      }),
    })
  },

  AI_Writing({
    content,
    command,
  }: AIWritingPayload): Promise<any> {
    return fetch(`${SERVER_URL}/api/ai/ai_writing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        command,
        stream: true,
      }),
    })
  },

  AI_Image({
    prompt,
    model = 'jimeng',
  }: AIImagePayload): Promise<any> {
    // 调用我们新创建的后端服务
    return fetch('http://localhost:3001/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
      }),
    })
  },

  SaveTemplate({
    slideData,
    templateName,
  }: {
    slideData: any
    templateName?: string
  }): Promise<any> {
    // 调用保存模板API
    return fetch('http://localhost:3001/api/save-template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slideData,
        templateName,
      }),
    })
  },
}
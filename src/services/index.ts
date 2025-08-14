import axios from './config'

// 开发环境使用本地服务器，生产环境使用远程服务器
export const SERVER_URL = (import.meta.env.MODE === 'development') ? '' : 'https://server.pptist.cn'

export const ASSET_URL = 'https://asset.pptist.cn'

interface AIPPTOutlinePayload {
  content: string
  courseType?: string
  grade: string
  model: string
}

interface AIPPTPayload {
  content: string
  courseType?: string
  grade: string
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
  width?: number
  height?: number
}

interface TemplateMatchPayload {
  data: any
  templateId: string
  courseType?: string
  grade: string
  style: string
}

const api = {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
  },

  getFileData(filename: string): Promise<any> {
    // 使用本地后端服务获取数据
    return axios.get(`${SERVER_URL}/api/template/${filename}`)
  },

  AIPPT_Outline({
    content,
    courseType,
    grade,
    model,
  }: AIPPTOutlinePayload): Promise<any> {
    return fetch(`${SERVER_URL}/api/ai/outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        courseType,
        grade,
        model,
        stream: true,
      }),
    })
  },

  AIPPT({
    content,
    courseType,
    grade,
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
        courseType,
        grade,
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
    width,
    height,
  }: AIImagePayload): Promise<any> {
    // 调用我们新创建的后端服务
    return fetch(`${SERVER_URL}/api/image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
        width,
        height,
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
    return fetch(`${SERVER_URL}/api/save-template`, {
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

  // 模板匹配接口
  matchTemplate(searchCriteria: any): Promise<any> {
    return fetch(`${SERVER_URL}/api/template/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchCriteria),
    })
  },

  // 使用模板接口
  useTemplate({
    templateId,
    aiData,
  }: {
    templateId: string
    aiData: any
  }): Promise<any> {
    return fetch(`${SERVER_URL}/api/template/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId,
        aiData,
      }),
    })
  },

  // PPT单页上传接口
  uploadSlide(slideData: any): Promise<any> {
    return fetch(`${SERVER_URL}/api/ppt/upload-slide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slideData),
    }).then(response => response.json())
  },

  // PPT确认保存接口
  confirmSave(saveData: any): Promise<any> {
    return fetch(`${SERVER_URL}/api/ppt/confirm-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saveData),
    }).then(response => response.json())
  },
  
  // 根据pptID加载PPT数据
  getPPTById(pptId: string): Promise<any> {
    return fetch(`${SERVER_URL}/api/ppt/${pptId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => response.json())
  },

  // 重新生成AI数据
  regenerateAIData({
    content,
    pageNumber,
    totalPages,
  }: {
    content: string
    pageNumber?: number
    totalPages?: number
  }): Promise<any> {
    return fetch(`${SERVER_URL}/api/ai/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        pageNumber,
        totalPages,
      }),
    })
  },
}

// 导出 SERVER_URL 供其他组件使用
Object.defineProperty(api, 'SERVER_URL', {
  value: SERVER_URL,
  writable: false,
  enumerable: true,
  configurable: false
})

export default api
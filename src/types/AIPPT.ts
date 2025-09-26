export interface AIPPTCover {
  type: 'cover'
  data: {
    title: string
    text: string
  }
}

export interface AIPPTContents {
  type: 'contents'
  data: {
    items: string[]
  }
  offset?: number
}

export interface AIPPTTransition {
  type: 'transition'
  data: {
    title: string
    text: string
  }
}

export interface AIPPTContent {
  type: 'content'
  data: {
    title: string
    items: {
      title: string
      text: string
    }[]
  },
  offset?: number
}

export interface AIPPTEnd {
  type: 'end'
}

export type AIPPTSlide = AIPPTCover | AIPPTContents | AIPPTTransition | AIPPTContent | AIPPTEnd

// AI数据的元数据结构
export interface AIDataMetadata {
  words: string[]
  sentences: string[]
  questions: string[]
  imageDescriptions: string[]
  wordCount: number
  sentenceCount: number
  questionCount: number
  imageCount: number
  lastModified?: string
  syncVersion?: number
  templateId?: string // 添加模板ID字段
}

// AI数据的完整结构
export interface AIData {
  title?: string
  subtitle?: string
  content?: string
  items?: any[]
  words?: string[]
  sentences?: string[]
  imageDescriptions?: string[]
  components?: any[]
  metadata?: AIDataMetadata
  isInteractive?: boolean
  [key: string]: any // 允许其他动态属性
}
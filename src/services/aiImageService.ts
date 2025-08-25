import message from '@/utils/message'

// 直接使用 fetch API 避免循环依赖
const SERVER_URL = (import.meta.env.MODE === 'development') ? '' : 'https://server.pptist.cn'

/**
 * AI 图片生成服务配置
 */
export interface AIImageConfig {
  prompt: string
  model?: string
  width?: number
  height?: number
}

/**
 * AI 图片生成响应
 */
export interface AIImageResponse {
  success: boolean
  imageUrl?: string
  error?: string
}

/**
 * 统一的 AI 图片生成服务
 * 避免在多个地方重复实现相同的逻辑
 */
class AIImageService {
  private static instance: AIImageService
  
  // 默认配置
  private defaultConfig = {
    model: 'jimeng',
    width: 800,
    height: 600
  }

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AIImageService {
    if (!AIImageService.instance) {
      AIImageService.instance = new AIImageService()
    }
    return AIImageService.instance
  }

  /**
   * 生成图片
   * @param config 图片生成配置
   * @returns Promise<AIImageResponse>
   */
  async generateImage(config: AIImageConfig): Promise<AIImageResponse> {
    try {
      const { prompt, model = this.defaultConfig.model, width = this.defaultConfig.width, height = this.defaultConfig.height } = config

      if (!prompt?.trim()) {
        return {
          success: false,
          error: '图片描述不能为空'
        }
      }

      console.log('🎨 开始生成图片:', { prompt, model, width, height })

      const response = await fetch(`${SERVER_URL}/api/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          width,
          height
        })
      })
      
      const data = await response.json()
      
      // 统一处理不同模型的响应格式
      const imageUrl = this.extractImageUrl(data, model)
      
      if (imageUrl) {
        console.log('✅ 图片生成成功:', imageUrl)
        return {
          success: true,
          imageUrl
        }
      } 
      const errorMsg = data.message || data.errorMessage || '图片生成失败'
      console.error('❌ 图片生成失败:', errorMsg)
      return {
        success: false,
        error: errorMsg
      }
      
      
    }
    catch (error) {
      console.error('💥 图片生成异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片生成异常'
      }
    }
  }

  /**
   * 批量生成图片
   * @param configs 图片生成配置数组
   * @param onProgress 进度回调
   * @returns Promise<AIImageResponse[]>
   */
  async generateImages(
    configs: AIImageConfig[], 
    onProgress?: (completed: number, total: number) => void
  ): Promise<AIImageResponse[]> {
    const results: AIImageResponse[] = []
    const total = configs.length
    
    console.log(`🚀 开始批量生成 ${total} 个图片`)
    
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]
      const result = await this.generateImage(config)
      results.push(result)
      
      // 调用进度回调
      if (onProgress) {
        onProgress(i + 1, total)
      }
      
      console.log(`📊 进度: ${i + 1}/${total}, 成功: ${result.success}`)
    }
    
    const successCount = results.filter(r => r.success).length
    console.log(`🎉 批量生成完成: ${successCount}/${total} 成功`)
    
    return results
  }

  /**
   * 并发生成图片（适用于大量图片生成）
   * @param configs 图片生成配置数组
   * @param concurrency 并发数量，默认为3
   * @param onProgress 进度回调
   * @returns Promise<AIImageResponse[]>
   */
  async generateImagesConcurrent(
    configs: AIImageConfig[], 
    concurrency: number = 3,
    onProgress?: (completed: number, total: number) => void
  ): Promise<AIImageResponse[]> {
    const total = configs.length
    const results: AIImageResponse[] = new Array(total)
    let completed = 0
    
    console.log(`🚀 开始并发生成 ${total} 个图片，并发数: ${concurrency}`)
    
    // 分批处理
    const batches: Promise<void>[] = []
    
    for (let i = 0; i < total; i += concurrency) {
      const batch = configs.slice(i, i + concurrency)
      const batchPromise = Promise.all(
        batch.map(async (config, batchIndex) => {
          const globalIndex = i + batchIndex
          const result = await this.generateImage(config)
          results[globalIndex] = result
          completed++
          
          // 调用进度回调
          if (onProgress) {
            onProgress(completed, total)
          }
          
          console.log(`📊 进度: ${completed}/${total}, 索引: ${globalIndex}, 成功: ${result.success}`)
        })
      ).then(() => {})
      
      batches.push(batchPromise)
    }
    
    await Promise.all(batches)
    
    const successCount = results.filter(r => r.success).length
    console.log(`🎉 并发生成完成: ${successCount}/${total} 成功`)
    
    return results
  }

  /**
   * 从响应数据中提取图片URL
   * @param data API响应数据
   * @param model 使用的模型
   * @returns 图片URL或null
   */
  private extractImageUrl(data: any, model: string): string | null {
    try {
      if (model === 'jimeng') {
        // 火山引擎即梦服务的响应格式
        if (data.status === 'success' && data.data) {
          // 检查嵌套的data结构
          if (data.data.data && data.data.data.image_url) {
            return data.data.data.image_url
          }
          else if (data.data.image_url) {
            return data.data.image_url
          }
        }
      }
      else {
        // 其他AI服务的响应格式
        if (data.success && data.data && data.data.url) {
          return data.data.url
        }
      }
      
      return null
    }
    catch (error) {
      console.error('❌ 提取图片URL失败:', error)
      return null
    }
  }

  /**
   * 设置默认配置
   * @param config 默认配置
   */
  setDefaultConfig(config: Partial<typeof this.defaultConfig>) {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return { ...this.defaultConfig }
  }
}

// 导出单例实例
export const aiImageService = AIImageService.getInstance()

// 导出便捷方法
export const generateAIImage = (config: AIImageConfig) => aiImageService.generateImage(config)
export const generateAIImages = (configs: AIImageConfig[], onProgress?: (completed: number, total: number) => void) => 
  aiImageService.generateImages(configs, onProgress)
export const generateAIImagesConcurrent = (
  configs: AIImageConfig[], 
  concurrency?: number, 
  onProgress?: (completed: number, total: number) => void
) => aiImageService.generateImagesConcurrent(configs, concurrency, onProgress)

export default aiImageService
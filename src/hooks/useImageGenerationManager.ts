import { ref, computed } from 'vue'
import type { PPTImageElement, Slide } from '@/types/slides'
import { useSlidesStore } from '@/store'
import { useImageGenerationStore } from '@/store/imageGeneration'
import { aiImageService } from '@/services/aiImageService'
import useInteractiveImageUpdater from '@/hooks/useInteractiveImageUpdater'
import message from '@/utils/message'

/**
 * 优先级队列项接口
 */
export interface QueueItem {
  id: string
  slideId: string
  elementId: string
  prompt: string
  element: PPTImageElement
  priority: number // 0=高优先级, 1=中优先级, 2=低优先级
  type: 'static' | 'interactive'
  templateDataPath?: string // 互动图片的更新路径
  retryCount?: number
  createdAt: number
}

/**
 * 处理进度信息
 */
export interface ProcessProgress {
  total: number
  processed: number
  success: number
  failed: number
  percentage: number
}

/**
 * 统一的图片处理管理器
 * 负责管理所有类型图片的生成队列和处理流程
 */
export class ImageGenerationManager {
  private static instance: ImageGenerationManager
  private store = useImageGenerationStore()
  private imageUpdater = useInteractiveImageUpdater()
  
  // 缓存管理
  private _cache = new Map<string, string>()
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): ImageGenerationManager {
    if (!ImageGenerationManager.instance) {
      ImageGenerationManager.instance = new ImageGenerationManager()
    }
    return ImageGenerationManager.instance
  }
  
  /**
   * 响应式状态访问器 - 直接从store获取
   */
  get processing() {
    return computed(() => this.store.processing)
  }
  
  get queue() {
    return computed(() => this.store.queue)
  }
  
  get progress() {
    return computed(() => this.store.progress)
  }
  
  get settings() {
    return computed(() => this.store.settings)
  }
  
  /**
   * 计算属性
   */
  get queueLength() {
    return computed(() => this.store.queueLength)
  }
  
  get hasActiveJobs() {
    return computed(() => this.store.hasActiveJobs)
  }
  
  /**
   * 统一的入口：处理幻灯片中的所有图片
   */
  async processSlideImages(slide: Slide): Promise<void> {
    console.log('🎯 ImageGenerationManager: 开始处理幻灯片图片', {
      slideId: slide.id,
      hasElements: !!slide.elements,
      hasTemplateData: !!slide.templateData
    })
    
    try {
      const tasks: QueueItem[] = []
      
      // 收集静态图片任务
      const staticTasks = this.collectStaticImages(slide)
      tasks.push(...staticTasks)
      
      // 收集互动图片任务
      const interactiveTasks = this.collectInteractiveImages(slide)
      tasks.push(...interactiveTasks)
      
      console.log('📋 收集到的图片任务:', {
        staticCount: staticTasks.length,
        interactiveCount: interactiveTasks.length,
        totalCount: tasks.length
      })
      
      if (tasks.length === 0) {
        console.log('ℹ️ 没有需要处理的图片')
        return
      }
      
      // 添加到队列并开始处理
      this.store.addToQueue(tasks)
      await this.processQueue()
      
    }
    catch (error) {
      console.error('❌ 处理幻灯片图片失败:', error)
      message.error('处理幻灯片图片失败: ' + (error as Error).message)
    }
  }
  
  /**
   * 收集静态图片任务
   */
  private collectStaticImages(slide: Slide): QueueItem[] {
    const tasks: QueueItem[] = []
    
    if (!slide.elements) return tasks
    
    slide.elements.forEach((element, index) => {
      if (element.type === 'image' && 
          element.alt && 
          element.alt.trim() && 
          element.alt !== 'REMOVE_THIS_ELEMENT') {
        
        const task: QueueItem = {
          id: `static-${slide.id}-${element.id}-${Date.now()}`,
          slideId: slide.id,
          elementId: element.id,
          prompt: element.alt.trim(),
          element: element as PPTImageElement,
          priority: 0, // 静态图片高优先级
          type: 'static',
          retryCount: 0,
          createdAt: Date.now()
        }
        
        tasks.push(task)
        console.log(`✅ 收集静态图片任务: 元素${index} ID=${element.id}, alt="${element.alt}"`)
      }
    })
    
    return tasks
  }
  
  /**
   * 收集互动图片任务
   */
  private collectInteractiveImages(slide: Slide): QueueItem[] {
    const tasks: QueueItem[] = []
    
    if (!slide.templateData) return tasks
    
    // 获取图片配置
    const imageConfig = this.getEffectiveImageConfig(slide)
    const dimensions = imageConfig || { width: 400, height: 300 }
    
    // 递归提取互动图片
    const extractImages = (obj: any, path = ''): void => {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key
        
        if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
          // 忽略 imgUrl 检查，只要有 imgAlt 就创建任务
          const imgUrlPath = currentPath.replace('imgAlt', 'imgUrl')
          
          // 创建虚拟元素
          const virtualElement: PPTImageElement = {
            id: `interactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'image',
            width: dimensions.width,
            height: dimensions.height,
            left: 0,
            top: 0,
            rotate: 0,
            fixedRatio: true,
            src: '',
            alt: value.trim(),
            // 特殊标记
            isInteractiveTemplate: true,
            templateDataPath: imgUrlPath
          } as any

          const task: QueueItem = {
            id: `interactive-${slide.id}-${virtualElement.id}-${Date.now()}`,
            slideId: slide.id,
            elementId: virtualElement.id,
            prompt: value.trim(),
            element: virtualElement,
            priority: 0, // 互动图片中优先级
            type: 'interactive',
            templateDataPath: imgUrlPath,
            retryCount: 0,
            createdAt: Date.now()
          }

          tasks.push(task)
          console.log('🖼️ 收集互动图片任务:', {
            path: currentPath,
            prompt: value,
            imgUrlPath
          })
        }
        else if (typeof value === 'object' && value !== null) {
          extractImages(value, currentPath)
        }
      })
    }
    
    extractImages(slide.templateData)
    return tasks
  }
  

  
  /**
   * 处理队列
   */
  async processQueue(): Promise<void> {
    if (this.store.processing) {
      console.log('⏳ 队列正在处理中，跳过重复调用')
      return
    }
    
    if (this.store.queue.length === 0) {
      console.log('📭 队列为空，无需处理')
      return
    }
    
    console.log(`🚀 开始处理队列，共 ${this.store.queue.length} 个任务`)
    
    this.store.setProcessing(true)
    this.store.initializeProgress(this.store.queue.length)
    
    // 显示进度消息
    const progressMessage = message.success(
      `正在为 ${this.store.progress.total} 个图片元素生成AI图片，请稍候...`,
      { duration: 0 }
    )
    
    try {
      // 并发处理队列
      await this.processConcurrent()
      
      // 完成处理
      this.completeProcessing()
      
      if (progressMessage) {
        progressMessage.close()
        message.success(
          `图片生成完成！成功: ${this.store.progress.success}, 失败: ${this.store.progress.failed}`
        )
      }
      
    }
    catch (error) {
      console.error('❌ 队列处理失败:', error)
      if (progressMessage) {
        progressMessage.close()
        message.error('图片生成过程中出现错误: ' + (error as Error).message)
      }
    }
    finally {
      this.store.setProcessing(false)
    }
  }
  
  /**
   * 并发处理任务
   */
  private async processConcurrent(): Promise<void> {
    const concurrency = this.store.settings.concurrency
    const tasks = [...this.store.queue]
    this.store.clearQueue() // 清空队列
    
    // 分批处理
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency)
      const promises = batch.map(task => this.processTask(task))
      
      await Promise.allSettled(promises)
    }
  }
  
  /**
   * 处理单个任务
   */
  private async processTask(task: QueueItem): Promise<void> {
    try {
      console.log(`🔄 处理任务: ${task.type} - ${task.prompt}`)
      
      // 检查缓存
      if (this.store.settings.enableCache) {
        const cachedUrl = this._cache.get(task.prompt)
        if (cachedUrl) {
          console.log('💾 使用缓存图片:', task.prompt)
          await this.updateImage(task, cachedUrl)
          this.store.incrementSuccess()
          return
        }
      }
      
      // 根据任务类型确定宽高
      let width: number, height: number
      
      if (task.type === 'static') {
        // 静态图片使用元素的宽高
        width = task.element.width || 800
        height = task.element.height || 600
      }
      else {
        // 互动图片使用imageConfig中的宽高
        width = task.element.width || 400
        height = task.element.height || 300
      }
      
      console.log(`📐 图片尺寸设置: ${task.type} - ${width}x${height}`)
      
      // 生成图片
      const response = await aiImageService.generateImage({
        prompt: task.prompt,
        model: 'jimeng',
        width,
        height
      })
      
      if (response.success && response.imageUrl) {
        // 缓存结果
        if (this.store.settings.enableCache) {
          this._cache.set(task.prompt, response.imageUrl)
        }
        
        // 更新图片
        await this.updateImage(task, response.imageUrl)
        this.store.incrementSuccess()
        
        console.log(`✅ 任务完成: ${task.type} - ${task.prompt}`)
      }
      else {
        throw new Error(response.error || '图片生成失败')
      }
      
    }
    catch (error) {
      console.error(`❌ 任务失败: ${task.type} - ${task.prompt}`, error)
      
      // 重试逻辑
      if (task.retryCount! < this.store.settings.maxRetries) {
        task.retryCount = (task.retryCount || 0) + 1
        console.log(`🔄 重试任务 (${task.retryCount}/${this.store.settings.maxRetries}): ${task.prompt}`)
        
        // 延迟后重试
        setTimeout(() => {
          this.processTask(task)
        }, this.store.settings.retryDelay)
        
        return
      }
      
      this.store.incrementFailed()
    }
  }
  
  /**
   * 更新图片
   */
  private async updateImage(task: QueueItem, imageUrl: string): Promise<void> {
    const slidesStore = useSlidesStore()
    
    if (task.type === 'static') {
      // 更新静态图片
      slidesStore.updateElement({
        id: task.elementId,
        props: { src: imageUrl },
        slideId: task.slideId
      })
    }
    else if (task.type === 'interactive' && task.templateDataPath) {
      // 使用新的互动图片更新机制
      await this.imageUpdater.updateInteractiveImage(
        task.slideId,
        task.templateDataPath,
        imageUrl,
        {
          strategy: 'debounced',
          debounceDelay: 300,
          showRefreshTip: false
        }
      )
      console.log(`✅ 互动图片更新完成: ${task.templateDataPath}`)
    }
  }
  
  /**
   * 获取互动图片更新器实例
   */
  getImageUpdater() {
    return this.imageUpdater
  }
  
  /**
   * 获取有效的图片配置
   */
  private getEffectiveImageConfig(slide: Slide): any {
    return slide.imageConfig || 
           slide.aiData?.interactiveData?.imageConfig || 
           slide.templateData?.imageConfig
  }
  
  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  /**
   * 设置嵌套对象的值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }
  
  /**
   * 完成处理
   */
  private completeProcessing(): void {
    console.log('✅ 队列处理完成:', this.store.progress)
  }
  
  /**
   * 清空队列
   */
  clearQueue(): void {
    this.store.clearQueue()
    this.store.resetProgress()
  }
  
  /**
   * 更新设置
   */
  updateSettings(settings: Partial<typeof this.store.settings>): void {
    this.store.updateSettings(settings)
  }
}

/**
 * Hook 接口
 */
export default function useImageGenerationManager() {
  const manager = ImageGenerationManager.getInstance()
  
  return {
    // 状态
    processing: manager.processing,
    queue: manager.queue,
    progress: manager.progress,
    settings: manager.settings,
    queueLength: manager.queueLength,
    hasActiveJobs: manager.hasActiveJobs,
    
    // 方法
    processSlideImages: (slide: Slide) => manager.processSlideImages(slide),
    clearQueue: () => manager.clearQueue(),
    updateSettings: (settings: any) => manager.updateSettings(settings)
  }
}
import { defineStore } from 'pinia'
import type { QueueItem, ProcessProgress } from '@/hooks/useImageGenerationManager'

export interface ImageGenerationState {
  // 队列管理
  queue: QueueItem[]
  processing: boolean
  
  // 进度跟踪
  progress: ProcessProgress
  
  // 设置配置
  settings: {
    concurrency: number
    maxRetries: number
    retryDelay: number
    enableCache: boolean
  }
  
  // 缓存管理
  cache: Map<string, string>
  
  // 历史记录
  history: {
    id: string
    timestamp: number
    slideId: string
    prompt: string
    imageUrl: string
    type: 'static' | 'interactive'
    success: boolean
    error?: string
  }[]
}

export const useImageGenerationStore = defineStore('imageGeneration', {
  state: (): ImageGenerationState => ({
    queue: [],
    processing: false,
    
    progress: {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      percentage: 0
    },
    
    settings: {
      concurrency: 2,
      maxRetries: 2,
      retryDelay: 1000,
      enableCache: true
    },
    
    cache: new Map(),
    
    history: []
  }),
  
  getters: {
    // 队列相关
    queueLength: (state) => state.queue.length,
    hasActiveJobs: (state) => state.processing || state.queue.length > 0,
    
    // 按优先级排序的队列
    sortedQueue: (state) => {
      return [...state.queue].sort((a, b) => {
        // 优先级排序 (0=高优先级)
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        // 相同优先级按创建时间排序
        return a.createdAt - b.createdAt
      })
    },
    
    // 按类型分组的队列
    queueByType: (state) => {
      return {
        static: state.queue.filter(item => item.type === 'static'),
        interactive: state.queue.filter(item => item.type === 'interactive')
      }
    },
    
    // 进度相关
    progressPercentage: (state) => {
      if (state.progress.total === 0) return 0
      return Math.round((state.progress.processed / state.progress.total) * 100)
    },
    
    // 缓存相关
    cacheSize: (state) => state.cache.size,
    
    // 历史记录相关
    recentHistory: (state) => {
      return state.history
        .slice(-10)
        .sort((a, b) => b.timestamp - a.timestamp)
    },
    
    successRate: (state) => {
      if (state.history.length === 0) return 0
      const successCount = state.history.filter(item => item.success).length
      return Math.round((successCount / state.history.length) * 100)
    }
  },
  
  actions: {
    // 队列管理
    addToQueue(items: QueueItem | QueueItem[]) {
      const itemsArray = Array.isArray(items) ? items : [items]
      this.queue.push(...itemsArray)
      this.updateProgress()
    },
    
    removeFromQueue(itemId: string) {
      const index = this.queue.findIndex(item => item.id === itemId)
      if (index !== -1) {
        this.queue.splice(index, 1)
        this.updateProgress()
      }
    },
    
    clearQueue() {
      this.queue = []
      this.resetProgress()
    },
    
    // 处理状态管理
    setProcessing(processing: boolean) {
      this.processing = processing
    },
    
    // 进度管理
    initializeProgress(total: number) {
      this.progress = {
        total,
        processed: 0,
        success: 0,
        failed: 0,
        percentage: 0
      }
    },
    
    incrementProcessed() {
      this.progress.processed++
      this.updateProgressPercentage()
    },
    
    incrementSuccess() {
      this.progress.success++
      this.incrementProcessed()
    },
    
    incrementFailed() {
      this.progress.failed++
      this.incrementProcessed()
    },
    
    updateProgressPercentage() {
      if (this.progress.total > 0) {
        this.progress.percentage = Math.round(
          (this.progress.processed / this.progress.total) * 100
        )
      }
    },
    
    resetProgress() {
      this.progress = {
        total: 0,
        processed: 0,
        success: 0,
        failed: 0,
        percentage: 0
      }
    },
    
    updateProgress() {
      this.progress.total = this.queue.length + this.progress.processed
      this.updateProgressPercentage()
    },
    
    // 设置管理
    updateSettings(newSettings: Partial<ImageGenerationState['settings']>) {
      this.settings = { ...this.settings, ...newSettings }
    },
    
    // 缓存管理
    setCache(key: string, value: string) {
      if (this.settings.enableCache) {
        this.cache.set(key, value)
      }
    },
    
    getCache(key: string): string | undefined {
      if (this.settings.enableCache) {
        return this.cache.get(key)
      }
      return undefined
    },
    
    clearCache() {
      this.cache.clear()
    },
    
    // 历史记录管理
    addToHistory(record: Omit<ImageGenerationState['history'][0], 'timestamp'>) {
      this.history.push({
        ...record,
        timestamp: Date.now()
      })
      
      // 限制历史记录数量，保留最近100条
      if (this.history.length > 100) {
        this.history = this.history.slice(-100)
      }
    },
    
    clearHistory() {
      this.history = []
    },
    
    // 重置所有状态
    resetAll() {
      this.clearQueue()
      this.setProcessing(false)
      this.resetProgress()
      this.clearCache()
    },
    
    // 获取统计信息
    getStatistics() {
      return {
        queue: {
          total: this.queueLength,
          byType: this.queueByType,
          byPriority: {
            high: this.queue.filter(item => item.priority === 0).length,
            medium: this.queue.filter(item => item.priority === 1).length,
            low: this.queue.filter(item => item.priority === 2).length
          }
        },
        progress: this.progress,
        cache: {
          size: this.cacheSize,
          enabled: this.settings.enableCache
        },
        history: {
          total: this.history.length,
          successRate: this.successRate,
          recent: this.recentHistory.length
        }
      }
    }
  }
})
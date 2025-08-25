import { ref, nextTick } from 'vue'
import { useSlidesStore } from '@/store'
import { useImageGenerationStore } from '@/store/imageGeneration'
import message from '@/utils/message'

/**
 * 互动图片更新器
 * 专门处理互动图片更新后的iframe刷新和状态同步
 */
export interface IframeRefreshOptions {
  // 刷新策略
  strategy: 'immediate' | 'debounced' | 'batch'
  // 防抖延迟时间(ms)
  debounceDelay: number
  // 批量更新间隔(ms)
  batchInterval: number
  // 是否强制刷新
  forceRefresh: boolean
  // 是否显示刷新提示
  showRefreshTip: boolean
}

export interface UpdateRecord {
  id: string
  slideId: string
  templateDataPath: string
  oldValue: any
  newValue: any
  timestamp: number
  refreshed: boolean
}

export default function useInteractiveImageUpdater() {
  const slidesStore = useSlidesStore()
  const imageStore = useImageGenerationStore()
  
  // 刷新配置
  const refreshOptions = ref<IframeRefreshOptions>({
    strategy: 'debounced',
    debounceDelay: 500,
    batchInterval: 2000,
    forceRefresh: false,
    showRefreshTip: true
  })
  
  // 更新记录
  const updateRecords = ref<UpdateRecord[]>([])
  
  // 待刷新的iframe列表
  const pendingRefreshes = ref<Set<string>>(new Set())
  
  // 是否正在处理
  const isRefreshing = ref(false)
  
  /**
   * 更新互动图片
   */
  const updateInteractiveImage = (
    slideId: string,
    templateDataPath: string,
    imageUrl: string,
    options?: Partial<IframeRefreshOptions>
  ): void => {
    try {
      const slide = slidesStore.slides.find(s => s.id === slideId)
      if (!slide) {
        throw new Error(`找不到幻灯片: ${slideId}`)
      }
      
      // 获取旧值
      const oldValue = getNestedValue(slide.templateData, templateDataPath)
      
      // 更新templateData
      setNestedValue(slide.templateData, templateDataPath, imageUrl)
      
      // 记录更新
      const updateRecord: UpdateRecord = {
        id: `${slideId}_${templateDataPath}_${Date.now()}`,
        slideId,
        templateDataPath,
        oldValue,
        newValue: imageUrl,
        timestamp: Date.now(),
        refreshed: false
      }
      
      updateRecords.value.push(updateRecord)
      
      // 添加到历史记录
      imageStore.addToHistory({
        id: updateRecord.id,
        slideId,
        prompt: templateDataPath,
        imageUrl,
        type: 'interactive',
        success: true
      })
      
      console.log('🔄 更新互动图片:', {
        slideId,
        path: templateDataPath,
        imageUrl,
        oldValue,
        newValue: imageUrl
      })
      
      // iframe刷新功能已移除，切换slide时会通过iframe Ready消息进行数据传输
      updateRecord.refreshed = true
      console.log('✅ 互动图片更新完成:', slideId)
      
    }
    catch (error) {
      console.error('❌ 更新互动图片失败:', error)
      message.error(`更新互动图片失败: ${(error as Error).message}`)
      throw error
    }
  }
  
  // iframe刷新功能已移除，切换slide时会通过iframe Ready消息进行数据传输
  
  /**
   * 更新刷新配置
   */
  const updateRefreshOptions = (options: Partial<IframeRefreshOptions>): void => {
    refreshOptions.value = { ...refreshOptions.value, ...options }
  }
  
  /**
   * 获取嵌套对象的值
   */
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }
  
  /**
   * 设置嵌套对象的值
   */
  const setNestedValue = (obj: any, path: string, value: any): void => {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)
    target[lastKey] = value
  }
  
  /**
   * 清理更新记录
   */
  const clearUpdateRecords = (): void => {
    updateRecords.value = []
  }
  
  /**
   * 获取更新统计
   */
  const getUpdateStatistics = () => {
    const total = updateRecords.value.length
    const refreshed = updateRecords.value.filter(r => r.refreshed).length
    const pending = total - refreshed
    
    return {
      total,
      refreshed,
      pending,
      pendingSlides: pendingRefreshes.value.size,
      refreshRate: total > 0 ? Math.round((refreshed / total) * 100) : 0
    }
  }
  
  return {
    // 状态
    isRefreshing,
    refreshOptions,
    updateRecords,
    pendingRefreshes,
    
    // 方法
    updateInteractiveImage,
    updateRefreshOptions,
    clearUpdateRecords,
    getUpdateStatistics
  }
}
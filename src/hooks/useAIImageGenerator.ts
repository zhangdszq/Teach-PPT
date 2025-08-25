import type { Slide } from '@/types/slides'
import { computed } from 'vue'
import { ImageGenerationManager } from '@/hooks/useImageGenerationManager'
import message from '@/utils/message'

/**
 * AI图片生成器 Hook
 * 重构后使用统一的ImageGenerationManager
 */
export default () => {
  const manager = ImageGenerationManager.getInstance()

  // 从manager获取响应式状态
  const isGeneratingImages = manager.processing
  const imageGenerationProgress = manager.progress
  const imageGenerationQueue = manager.queue

  // 兼容性计算属性
  const totalImageCount = computed(() => manager.progress.value.total)
  const processedImageCount = computed(() => manager.progress.value.processed)

  /**
   * 处理单个幻灯片的图片生成
   */
  const processSlideImages = async (slide: Slide): Promise<void> => {
    try {
      await manager.processSlideImages(slide)
    }
    catch (error) {
      console.error('❌ 处理幻灯片图片失败:', error)
      message.error(`处理幻灯片图片失败: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * 启动图片生成（兼容性方法）
   */
  const startImageGeneration = async (): Promise<void> => {
    try {
      await manager.processQueue()
    } 
    catch (error) {
      console.error('❌ 启动图片生成失败:', error)
      message.error(`启动图片生成失败: ${(error as Error).message}`)
      throw error
    }
  }


  /**
   * 清空队列
   */
  const clearImageQueue = (): void => {
    manager.clearQueue()
  }

  /**
   * 更新设置
   */
  const updateSettings = (settings: any): void => {
    manager.updateSettings(settings)
  }

  /**
   * 获取管理器实例（用于高级操作）
   */
  const getManager = () => manager

  /**
   * 获取互动图片更新器
   */
  const getImageUpdater = () => manager.getImageUpdater()



  return {
    // 状态
    isGeneratingImages,
    imageGenerationProgress,
    imageGenerationQueue,
    totalImageCount,
    processedImageCount,

    // 方法
    processSlideImages,
    startImageGeneration,
    clearImageQueue,
    updateSettings,

    // 高级接口
    getManager,
    getImageUpdater,



    // 队列状态
    queueLength: manager.queueLength,
    hasActiveJobs: manager.hasActiveJobs,
    settings: manager.settings
  }
}
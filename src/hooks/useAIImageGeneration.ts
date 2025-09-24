import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTImageElement, Slide } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import { ImageGenerationManager } from '@/hooks/useImageGenerationManager'
import useInteractiveImageUpdater from '@/hooks/useInteractiveImageUpdater'
import { aiImageService } from '@/services/aiImageService'
import message from '@/utils/message'

/**
 * 统一的AI图片生成Hook
 * 整合了原有的useAIImage、useAIImageGenerator、useTemplateAIImageMethods等功能
 * 提供简化的API接口，避免功能重复
 */
export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { handleElementId } = storeToRefs(mainStore)
  const { addHistorySnapshot } = useHistorySnapshot()
  
  // 获取核心管理器实例
  const manager = ImageGenerationManager.getInstance()
  const imageUpdater = useInteractiveImageUpdater()
  
  // 单图片生成状态
  const isGenerating = ref(false)
  
  // 从manager获取批量处理状态
  const isGeneratingImages = manager.processing
  const imageGenerationProgress = manager.progress
  const imageGenerationQueue = manager.queue
  const totalImageCount = computed(() => manager.progress.value.total)
  const processedImageCount = computed(() => manager.progress.value.processed)
  
  /**
   * 生成单个AI图片
   * 用于AIImageDialog等需要直接生成单个图片的场景
   */
  const generateAIImage = async (
    prompt: string, 
    model: string = 'jimeng', 
    width?: number, 
    height?: number, 
    slideIndex?: number, 
    elementId?: string
  ) => {
    // 使用传入的参数或默认值
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex
    const targetElementId = elementId || handleElementId.value
    
    console.log(`🎯 AI图片生成: 使用固定的幻灯片索引 ${targetSlideIndex}, 元素ID ${targetElementId}`)
    console.log(`📊 当前状态:`, {
      传入slideIndex: slideIndex,
      当前slideIndex: slidesStore.slideIndex,
      最终targetSlideIndex: targetSlideIndex,
      总幻灯片数: slidesStore.slides.length,
      幻灯片列表: slidesStore.slides.map((slide, idx) => ({ index: idx, id: slide.id }))
    })
    
    if (!targetElementId) {
      message.error('请先选择一个图片元素')
      return false
    }

    // 根据slideIndex获取对应的幻灯片
    const targetSlide = slidesStore.slides[targetSlideIndex]
    if (!targetSlide) {
      console.error(`❌ 目标幻灯片不存在: 索引 ${targetSlideIndex}, 总数 ${slidesStore.slides.length}`)
      message.error('目标幻灯片不存在')
      return false
    }

    const element = targetSlide.elements.find(el => el.id === targetElementId)
    if (!element || element.type !== 'image') {
      message.error('请选择一个图片元素')
      return false
    }

    if (!prompt.trim()) {
      message.error('请输入图片描述')
      return false
    }

    // 如果没有传递宽高，使用元素的宽高或默认值
    const imageWidth = width || element.width || 800
    const imageHeight = height || element.height || 600

    isGenerating.value = true
    const loadingMessage = message.success('正在生成图片，请稍候...', { duration: 0 })

    try {
      console.log(`🎨 开始为幻灯片 ${targetSlideIndex} 中的元素 ${targetElementId} 生成图片`)
      
      const result = await aiImageService.generateImage({
        prompt,
        model,
        width: imageWidth,
        height: imageHeight
      })
      
      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'AI图片生成失败')
      }
      
      const imageUrl = result.imageUrl
      
      if (!imageUrl) {
        throw new Error('未获取到图片URL')
      }
      
      // 使用slideId来精确更新指定幻灯片中的元素
      const slideId = targetSlide.id
      
      console.log(`🔍 准备更新元素:`, {
        targetSlideIndex,
        slideId,
        targetElementId,
        imageUrl: imageUrl,
        targetSlideElementsCount: targetSlide.elements.length,
        elementExists: targetSlide.elements.some(el => el.id === targetElementId)
      })
      
      slidesStore.updateElement({
        id: targetElementId,
        props: { src: imageUrl, alt: prompt },
        slideId: slideId
      })
      
      console.log(`✅ 图片生成成功: 幻灯片 ${targetSlideIndex} (${slideId}) 中的元素 ${targetElementId} 已更新`)
      
      addHistorySnapshot()
      loadingMessage.close()
      message.success('图片生成成功！')
      return true
    }
    catch (error) {
      console.error('AI图片生成失败:', error)
      loadingMessage.close()
      message.error('图片生成失败，请稍后重试')
      return false
    }
    finally {
      isGenerating.value = false
    }
  }
  
  /**
   * 处理幻灯片中的所有图片（包括静态和互动图片）
   * 使用ImageGenerationManager的队列机制
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
   * 处理当前幻灯片的模板图片
   */
  const processTemplateImages = async (slideIndex?: number) => {
    try {
      if (isGeneratingImages.value) {
        message.warning('正在处理图片，请稍候...')
        return
      }

      const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex

      if (targetSlideIndex < 0 || targetSlideIndex >= slidesStore.slides.length) {
        console.error(`❌ 幻灯片索引无效: ${targetSlideIndex}，总数: ${slidesStore.slides.length}`)
        message.warning('当前幻灯片无效')
        return
      }

      const slide = slidesStore.slides[targetSlideIndex]
      console.log(`📄 处理幻灯片: 索引 ${targetSlideIndex}, ID ${slide.id}, 元素数量 ${slide.elements.length}`)
      
      // 检查当前幻灯片中需要AI生成图片的元素
      const imageElements = slide.elements.filter(element => 
        element.type === 'image' && element.alt && element.alt.trim() && element.alt !== 'REMOVE_THIS_ELEMENT'
      )

      if (imageElements.length === 0) {
        console.log(`ℹ️ 幻灯片 ${targetSlideIndex} 未找到需要生成图片的元素`)
        message.info('当前幻灯片未找到需要生成图片的元素')
        return
      }

      console.log(`🚀 开始处理 ${imageElements.length} 个图片元素`)
      await processSlideImages(slide)
    }
    catch (error) {
      console.error('处理模板图片时发生错误:', error)
      message.error('处理图片时发生错误，请重试')
    }
  }
  
  /**
   * 处理所有幻灯片的模板图片
   */
  const processAllTemplateImages = async () => {
    if (isGeneratingImages.value) {
      message.warning('正在处理图片，请稍候...')
      return
    }

    const slidesWithImages = slidesStore.slides.filter(slide => 
      slide.elements.some(element => 
        element.type === 'image' && element.alt && element.alt.trim() && element.alt !== 'REMOVE_THIS_ELEMENT'
      )
    )

    if (slidesWithImages.length === 0) {
      message.info('未找到需要生成图片的元素')
      return
    }

    // 处理所有包含图片的幻灯片
    for (const slide of slidesWithImages) {
      await processSlideImages(slide)
    }

    // 启动图片生成队列处理
    await manager.processQueue()
  }
  
  /**
   * 检查幻灯片是否有需要处理的模板图片
   */
  const hasTemplateImages = (slideIndex?: number): boolean => {
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex
    
    if (targetSlideIndex < 0 || targetSlideIndex >= slidesStore.slides.length) {
      return false
    }
    
    const slide = slidesStore.slides[targetSlideIndex]
    return slide.elements.some(element =>
      element.type === 'image' && 
      element.alt && 
      element.alt.trim() && 
      element.alt !== 'REMOVE_THIS_ELEMENT'
    )
  }
  
  /**
   * 检查幻灯片是否有互动图片
   */
  const hasInteractiveImages = (slide: any): boolean => {
    console.log('🔍 检查幻灯片是否有互动图片:', {
      slideId: slide?.id,
      hasSlide: !!slide,
      hasTemplateData: !!slide?.templateData,
      templateData: slide?.templateData
    })
    
    if (!slide || !slide.templateData) {
      console.log('❌ 幻灯片或模板数据为空，无互动图片')
      return false
    }
    
    // 检查模板数据中是否有 imgAlt 字段且对应的 imgUrl 为空
    const checkImages = (obj: any, path = ''): boolean => {
      if (!obj || typeof obj !== 'object') {
        console.log(`🔍 检查对象 ${path}: 非对象类型，跳过`)
        return false
      }

      console.log(`🔍 检查对象 ${path}:`, obj)

      for (const key of Object.keys(obj)) {
        const value = obj[key]
        const currentPath = path ? `${path}.${key}` : key
        
        if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
          console.log(`✅ 找到 imgAlt 字段 ${currentPath}:`, value)
          // 忽略 imgUrl 检查，只要有 imgAlt 就认为有互动图片
          console.log(`🎯 发现互动图片 ${currentPath}:`, {
            imgAlt: value,
            imgUrl: obj.imgUrl
          })
          return true
        }
        else if (typeof value === 'object' && value !== null) {
          if (checkImages(value, currentPath)) {
            return true
          }
        }
      }
      return false
    }

    const result = checkImages(slide.templateData)
    console.log('🔍 互动图片检查结果:', result)
    return result
  }
  
  /**
   * 获取互动图片数量
   */
  const getInteractiveImageCount = (slide: any): number => {
    if (!slide || !slide.templateData) return 0
    
    let count = 0
    const countImages = (obj: any): void => {
      if (!obj || typeof obj !== 'object') return
      
      Object.keys(obj).forEach(key => {
        const value = obj[key]
        if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
          // 忽略 imgUrl 检查，只要有 imgAlt 就计数
          count++
        }
        else if (typeof value === 'object' && value !== null) {
          countImages(value)
        }
      })
    }
    
    countImages(slide.templateData)
    return count
  }
  
  /**
   * 获取幻灯片需要处理的图片数量
   */
  const getTemplateImageCount = (slideIndex?: number): number => {
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex
    
    if (targetSlideIndex < 0 || targetSlideIndex >= slidesStore.slides.length) {
      return 0
    }
    
    let count = 0
    const slide = slidesStore.slides[targetSlideIndex]
    slide.elements.forEach(element => {
      if (element.type === 'image' && 
          element.alt && 
          element.alt.trim() && 
          element.alt !== 'REMOVE_THIS_ELEMENT') {
        count++
      }
    })
    return count
  }
  
  /**
   * 获取所有幻灯片需要处理的图片数量
   */
  const getAllTemplateImageCount = (): number => {
    let count = 0
    slidesStore.slides.forEach(slide => {
      slide.elements.forEach(element => {
        if (element.type === 'image' && 
            element.alt && 
            element.alt.trim() && 
            element.alt !== 'REMOVE_THIS_ELEMENT') {
          count++
        }
      })
    })
    return count
  }
  
  /**
   * 启动图片生成队列
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
   * 清空生成队列
   */
  const clearImageQueue = (): void => {
    manager.clearQueue()
  }
  
  /**
   * 更新生成设置
   */
  const updateSettings = (settings: any): void => {
    manager.updateSettings(settings)
  }
  
  return {
    // 状态
    isGenerating, // 单图片生成状态
    isGeneratingImages, // 批量生成状态
    imageGenerationProgress,
    imageGenerationQueue,
    totalImageCount,
    processedImageCount,
    
    // 核心方法
    generateAIImage, // 生成单个图片
    processSlideImages, // 处理幻灯片中的所有图片
    startImageGeneration, // 启动队列处理
    clearImageQueue, // 清空队列
    updateSettings, // 更新设置
    
    // 便捷方法
    processTemplateImages, // 处理当前幻灯片的模板图片
    processAllTemplateImages, // 处理所有模板图片
    hasTemplateImages, // 检查是否有模板图片
    hasInteractiveImages, // 检查是否有互动图片
    getInteractiveImageCount, // 获取互动图片数量
    getTemplateImageCount, // 获取模板图片数量
    getAllTemplateImageCount, // 获取所有模板图片数量
    
    
    // 高级接口
    getManager: () => manager,
    getImageUpdater: () => imageUpdater,
    queueLength: manager.queueLength,
    hasActiveJobs: manager.hasActiveJobs,
    settings: manager.settings
  }
}
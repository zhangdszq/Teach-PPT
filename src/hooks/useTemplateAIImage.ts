import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { PPTImageElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import message from '@/utils/message'
import useAIPPT from '@/hooks/useAIPPT'

export default () => {
  const slidesStore = useSlidesStore()
  const { addHistorySnapshot } = useHistorySnapshot()
  
  // 使用useAIPPT中的图片生成队列功能
  const {
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    addToImageQueue,
    startImageGeneration,
    collectAndQueueImages
  } = useAIPPT()

  // 为了保持向后兼容，保留原有的ref名称但指向新的状态
  const isProcessing = isGeneratingImages
  const processedCount = processedImageCount
  const totalCount = totalImageCount

  /**
   * 处理当前幻灯片中具有alt属性的图片元素（主要方法）
   */
  const processTemplateImages = async (slideIndex?: number) => {
    try {
      if (isProcessing.value) {
        message.warning('正在处理图片，请稍候...')
        return
      }

      const { slideIndex: currentSlideIndex } = storeToRefs(slidesStore)
      const targetSlideIndex = slideIndex !== undefined ? slideIndex : currentSlideIndex.value

      if (targetSlideIndex < 0 || targetSlideIndex >= slidesStore.slides.length) {
        message.warning('当前幻灯片无效')
        return
      }

      const slide = slidesStore.slides[targetSlideIndex]
      
      // 收集当前幻灯片中需要AI生成图片的元素并添加到队列
      let imageCount = 0
      slide.elements.forEach(element => {
        if (element.type === 'image' && element.alt && element.alt.trim() && element.alt !== 'REMOVE_THIS_ELEMENT') {
          addToImageQueue(slide.id, element.id, element.alt.trim(), element as PPTImageElement)
          imageCount++
        }
      })

      if (imageCount === 0) {
        message.info('当前幻灯片未找到需要生成图片的元素')
        return
      }

      // 启动图片生成队列处理
      await startImageGeneration()
      
      // 添加历史快照
      if (processedCount.value > 0) {
        addHistorySnapshot()
      }
    } catch (error) {
      console.error('处理模板图片时发生错误:', error)
      message.error('处理图片时发生错误，请重试')
    }
  }

  /**
   * 处理所有幻灯片中的图片元素
   */
  const processAllTemplateImages = async () => {
    if (isProcessing.value) {
      message.warning('正在处理图片，请稍候...')
      return
    }

    // 使用collectAndQueueImages收集所有幻灯片中需要AI生成图片的元素
    collectAndQueueImages(slidesStore.slides)

    if (totalCount.value === 0) {
      message.info('未找到需要生成图片的元素')
      return
    }

    // 启动图片生成队列处理
    await startImageGeneration()
    
    // 添加历史快照
    if (processedCount.value > 0) {
      addHistorySnapshot()
    }
  }

  /**
   * 检查当前幻灯片是否有需要处理的图片
   */
  const hasTemplateImages = (slideIndex?: number): boolean => {
    const { slideIndex: currentSlideIndex } = storeToRefs(slidesStore)
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : currentSlideIndex.value
    
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
   * 获取当前幻灯片需要处理的图片数量
   */
  const getTemplateImageCount = (slideIndex?: number): number => {
    const { slideIndex: currentSlideIndex } = storeToRefs(slidesStore)
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : currentSlideIndex.value
    
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
   * 检查所有幻灯片是否有需要处理的图片
   */
  const hasAllTemplateImages = (): boolean => {
    return slidesStore.slides.some(slide =>
      slide.elements.some(element =>
        element.type === 'image' && 
        element.alt && 
        element.alt.trim() && 
        element.alt !== 'REMOVE_THIS_ELEMENT'
      )
    )
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

  return {
    isProcessing,
    processedCount,
    totalCount,
    processTemplateImages, // 默认处理当前幻灯片
    processAllTemplateImages, // 处理所有幻灯片的方法
    hasTemplateImages, // 检查当前幻灯片
    getTemplateImageCount, // 获取当前幻灯片图片数量
    hasAllTemplateImages, // 检查所有幻灯片
    getAllTemplateImageCount, // 获取所有幻灯片图片数量
    // 新增：图片生成进度相关
    imageGenerationProgress,
  }
}
import { useSlidesStore } from '@/store'
import type { PPTImageElement } from '@/types/slides'
import message from '@/utils/message'
import useAIPPT from '@/hooks/useAIPPT'

/**
 * 模板图片处理的便捷方法
 * 这些方法提供了对 useAIPPT 功能的简化接口
 */
export default () => {
  const {
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    addToImageQueue,
    startImageGeneration,
    collectAndQueueImages,
  } = useAIPPT()

  /**
   * 处理当前幻灯片中具有alt属性的图片元素（便捷方法）
   */
  const processTemplateImages = async (slideIndex?: number) => {
    try {
      if (isGeneratingImages.value) {
        message.warning('正在处理图片，请稍候...')
        return
      }

      const slidesStore = useSlidesStore()
      const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex

      if (targetSlideIndex < 0 || targetSlideIndex >= slidesStore.slides.length) {
        console.error(`❌ 幻灯片索引无效: ${targetSlideIndex}，总数: ${slidesStore.slides.length}`)
        message.warning('当前幻灯片无效')
        return
      }

      const slide = slidesStore.slides[targetSlideIndex]
      console.log(`📄 处理幻灯片: 索引 ${targetSlideIndex}, ID ${slide.id}, 元素数量 ${slide.elements.length}`)
      
      // 收集当前幻灯片中需要AI生成图片的元素并添加到队列
      let imageCount = 0
      slide.elements.forEach((element, index) => {
        if (element.type === 'image' && element.alt && element.alt.trim() && element.alt !== 'REMOVE_THIS_ELEMENT') {
          console.log(`✅ 添加图片到队列: 元素${index} ID=${element.id}, alt="${element.alt}", slideId=${slide.id}`)
          addToImageQueue(slide.id, element.id, element.alt.trim(), element as PPTImageElement)
          imageCount++
        }
      })

      if (imageCount === 0) {
        console.log(`ℹ️ 幻灯片 ${targetSlideIndex} 未找到需要生成图片的元素`)
        message.info('当前幻灯片未找到需要生成图片的元素')
        return
      }

      console.log(`🚀 开始处理 ${imageCount} 个图片元素`)
      // 启动图片生成队列处理
      await startImageGeneration()
    }
    catch (error) {
      console.error('处理模板图片时发生错误:', error)
      message.error('处理图片时发生错误，请重试')
    }
  }

  /**
   * 处理所有幻灯片中的图片元素（便捷方法）
   */
  const processAllTemplateImages = async () => {
    if (isGeneratingImages.value) {
      message.warning('正在处理图片，请稍候...')
      return
    }

    const slidesStore = useSlidesStore()
    // 使用collectAndQueueImages收集所有幻灯片中需要AI生成图片的元素
    collectAndQueueImages(slidesStore.slides)

    if (totalImageCount.value === 0) {
      message.info('未找到需要生成图片的元素')
      return
    }

    // 启动图片生成队列处理
    await startImageGeneration()
  }

  /**
   * 检查当前幻灯片是否有需要处理的图片（便捷方法）
   */
  const hasTemplateImages = (slideIndex?: number): boolean => {
    const slidesStore = useSlidesStore()
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
   * 获取当前幻灯片需要处理的图片数量（便捷方法）
   */
  const getTemplateImageCount = (slideIndex?: number): number => {
    const slidesStore = useSlidesStore()
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
   * 检查所有幻灯片是否有需要处理的图片（便捷方法）
   */
  const hasAllTemplateImages = (): boolean => {
    const slidesStore = useSlidesStore()
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
   * 获取所有幻灯片需要处理的图片数量（便捷方法）
   */
  const getAllTemplateImageCount = (): number => {
    const slidesStore = useSlidesStore()
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
    // 图片生成状态
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    // 便捷方法
    processTemplateImages,
    processAllTemplateImages,
    hasTemplateImages,
    getTemplateImageCount,
    hasAllTemplateImages,
    getAllTemplateImageCount,
    // 为了保持向后兼容，添加别名
    isProcessing: isGeneratingImages,
    processedCount: processedImageCount,
    totalCount: totalImageCount,
  }
}
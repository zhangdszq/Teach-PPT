import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { PPTImageElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import message from '@/utils/message'
import API from '@/services'

export default () => {
  const slidesStore = useSlidesStore()
  const { addHistorySnapshot } = useHistorySnapshot()

  const isProcessing = ref(false)
  const processedCount = ref(0)
  const totalCount = ref(0)

  /**
   * 队列处理图片生成，每次并发处理2个
   */
  const processImageQueue = async (imageElements: Array<{
    slideIndex: number
    element: PPTImageElement
    alt: string
  }>, concurrency: number = 2) => {
    const results: Array<{ success: boolean; element: PPTImageElement; alt: string; error?: any }> = []
    
    // 将图片元素分组，每组包含指定数量的并发请求
    for (let i = 0; i < imageElements.length; i += concurrency) {
      const batch = imageElements.slice(i, i + concurrency)
      
      // 并发处理当前批次
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const success = await generateImageForElement(item.element, item.alt)
            processedCount.value++
            return { success, element: item.element, alt: item.alt }
          } catch (error) {
            processedCount.value++
            console.error(`图片生成失败 (${item.alt}):`, error)
            return { success: false, element: item.element, alt: item.alt, error }
          }
        })
      )
      
      // 收集批次结果
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({ 
            success: false, 
            element: batch[0].element, 
            alt: batch[0].alt, 
            error: result.reason 
          })
        }
      })
      
      // 如果不是最后一批，稍微延迟一下避免请求过于密集
      if (i + concurrency < imageElements.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    return results
  }

  /**
   * 处理图片元素数组的通用方法
   */
  const processImageElements = async (imageElements: Array<{
    slideIndex: number
    element: PPTImageElement
    alt: string
  }>) => {
    totalCount.value = imageElements.length
    processedCount.value = 0
    isProcessing.value = true

    let currentLoadingMessage = message.success(
      `正在为 ${totalCount.value} 个图片元素生成AI图片，请稍候...`,
      { duration: 0 }
    )

    // 创建一个定时器来更新进度
    const progressTimer = setInterval(() => {
      if (currentLoadingMessage && processedCount.value < totalCount.value) {
        currentLoadingMessage.close()
        currentLoadingMessage = message.success(
          `正在生成图片 ${processedCount.value}/${totalCount.value}... (队列处理中)`,
          { duration: 0 }
        )
      }
    }, 1000)

    try {
      // 使用队列处理图片生成，每次并发2个
      const results = await processImageQueue(imageElements, 2)

      // 清除进度定时器
      clearInterval(progressTimer)

      // 统计结果
      const successCount = results.filter(result => result.success).length
      const failedCount = results.length - successCount

      // 确保关闭最后的loading消息
      if (currentLoadingMessage) {
        currentLoadingMessage.close()
      }

      if (successCount > 0) {
        addHistorySnapshot()
      }

      // 显示结果消息
      if (failedCount === 0) {
        message.success(`成功生成 ${successCount} 张AI图片！`)
      }
      else if (successCount > 0) {
        message.warning(`成功生成 ${successCount} 张图片，${failedCount} 张生成失败`)
      }
      else {
        message.error('所有图片生成失败，请检查网络连接或稍后重试')
      }

    }
    catch (error) {
      console.error('批量生成图片失败:', error)
      // 清除进度定时器
      clearInterval(progressTimer)
      // 确保关闭loading消息
      if (currentLoadingMessage) {
        currentLoadingMessage.close()
      }
      message.error('图片生成过程中出现错误')
    }
    finally {
      isProcessing.value = false
      processedCount.value = 0
      totalCount.value = 0
    }
  }

  /**
   * 处理当前幻灯片中具有alt属性的图片元素（主要方法）
   */
  const processTemplateImages = async (slideIndex?: number) => {
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

    // 收集当前幻灯片中具有alt属性的图片元素
    const imageElements: Array<{
      slideIndex: number
      element: PPTImageElement
      alt: string
    }> = []

    const slide = slidesStore.slides[targetSlideIndex]
    slide.elements.forEach(element => {
      if (element.type === 'image' && element.alt && element.alt.trim()) {
        // 排除已标记为移除的元素
        if (element.alt !== 'REMOVE_THIS_ELEMENT') {
          imageElements.push({
            slideIndex: targetSlideIndex,
            element: element as PPTImageElement,
            alt: element.alt.trim()
          })
        }
      }
    })

    if (imageElements.length === 0) {
      message.info('当前幻灯片未找到需要生成图片的元素')
      return
    }

    await processImageElements(imageElements)
  }

  /**
   * 处理所有幻灯片中的图片元素
   */
  const processAllTemplateImages = async () => {
    if (isProcessing.value) {
      message.warning('正在处理图片，请稍候...')
      return
    }

    // 收集所有具有alt属性的图片元素
    const imageElements: Array<{
      slideIndex: number
      element: PPTImageElement
      alt: string
    }> = []

    slidesStore.slides.forEach((slide, slideIndex) => {
      slide.elements.forEach(element => {
        if (element.type === 'image' && element.alt && element.alt.trim()) {
          // 排除已标记为移除的元素
          if (element.alt !== 'REMOVE_THIS_ELEMENT') {
            imageElements.push({
              slideIndex,
              element: element as PPTImageElement,
              alt: element.alt.trim()
            })
          }
        }
      })
    })

    if (imageElements.length === 0) {
      message.info('未找到需要生成图片的元素')
      return
    }

    await processImageElements(imageElements)
  }

  /**
   * 为单个图片元素生成AI图片
   */
  const generateImageForElement = async (element: PPTImageElement, prompt: string): Promise<boolean> => {
    try {
      const response = await API.AI_Image({ 
        prompt, 
        model: 'jimeng', // 默认使用即梦模型
        width: element.width || 800,
        height: element.height || 600
      })
      const data = await response.json()
      
      let imageUrl = ''
      
      // 处理即梦服务的响应格式 - 处理嵌套的data结构
      if (data.status === 'success' && data.data) {
        // 检查是否有嵌套的data结构
        if (data.data.data && data.data.data.image_url) {
          imageUrl = data.data.data.image_url
        } else if (data.data.image_url) {
          imageUrl = data.data.image_url
        } else {
          throw new Error('响应中未找到图片URL')
        }
      } else {
        throw new Error(data.message || data.errorMessage || '图片生成失败')
      }
      
      if (imageUrl) {
        // 更新图片元素的src
        slidesStore.updateElement({
          id: element.id,
          props: { src: imageUrl }
        })
        return true
      } else {
        throw new Error('未获取到图片URL')
      }
    }
    catch (error) {
      console.error(`为元素 ${element.id} 生成图片失败:`, error)
      throw error
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
  }
}
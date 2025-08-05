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
   * 检测并处理所有具有alt属性的图片元素
   */
  const processTemplateImages = async () => {
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

    totalCount.value = imageElements.length
    processedCount.value = 0
    isProcessing.value = true

    let currentLoadingMessage = message.success(
      `正在为 ${totalCount.value} 个图片元素生成AI图片，请稍候...`,
      { duration: 0 }
    )

    try {
      // 批量处理图片生成
      const results = await Promise.allSettled(
        imageElements.map(async (item, index) => {
          try {
            const success = await generateImageForElement(item.element, item.alt)
            processedCount.value++
            
            // 更新进度提示
            if (currentLoadingMessage) {
              currentLoadingMessage.close()
            }
            currentLoadingMessage = message.success(
              `正在生成图片 ${processedCount.value}/${totalCount.value}...`,
              { duration: 0 }
            )
            
            return { success, element: item.element, alt: item.alt }
          } catch (error) {
            processedCount.value++
            console.error(`图片生成失败 (${item.alt}):`, error)
            return { success: false, element: item.element, alt: item.alt, error }
          }
        })
      )

      // 统计结果
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length
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
   * 检查是否有需要处理的图片
   */
  const hasTemplateImages = (): boolean => {
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
   * 获取需要处理的图片数量
   */
  const getTemplateImageCount = (): number => {
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
    processTemplateImages,
    hasTemplateImages,
    getTemplateImageCount,
  }
}
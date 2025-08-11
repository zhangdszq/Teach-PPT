import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTImageElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import message from '@/utils/message'
import API from '@/services'

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { handleElementId } = storeToRefs(mainStore)
  const { addHistorySnapshot } = useHistorySnapshot()

  const isGenerating = ref(false)

  const generateAIImage = async (prompt: string, model: string = 'jimeng', width?: number, height?: number, slideIndex?: number, elementId?: string) => {
    // 使用传入的参数或默认值
    const targetSlideIndex = slideIndex !== undefined ? slideIndex : slidesStore.slideIndex
    const targetElementId = elementId || handleElementId.value
    
    console.log(`🎯 AI图片生成: 使用固定的幻灯片索引 ${targetSlideIndex}, 元素ID ${targetElementId}`);
    console.log(`📊 当前状态:`, {
      传入slideIndex: slideIndex,
      当前slideIndex: slidesStore.slideIndex,
      最终targetSlideIndex: targetSlideIndex,
      总幻灯片数: slidesStore.slides.length,
      幻灯片列表: slidesStore.slides.map((slide, idx) => ({ index: idx, id: slide.id }))
    });
    
    if (!targetElementId) {
      message.error('请先选择一个图片元素')
      return false
    }

    // 根据slideIndex获取对应的幻灯片
    const targetSlide = slidesStore.slides[targetSlideIndex]
    if (!targetSlide) {
      console.error(`❌ 目标幻灯片不存在: 索引 ${targetSlideIndex}, 总数 ${slidesStore.slides.length}`);
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
      
      const response = await API.AI_Image({ 
        prompt, 
        model, 
        width: imageWidth, 
        height: imageHeight 
      })
      const data = await response.json()
      
      let imageUrl = ''
      
      // 处理不同服务的响应格式
      if (model === 'jimeng') {
        // 火山引擎即梦服务的响应格式 - 处理嵌套的data结构
        if (data.status === 'success' && data.data) {
          // 检查是否有嵌套的data结构
          if (data.data.data && data.data.data.image_url) {
            imageUrl = data.data.data.image_url
          }
          else if (data.data.image_url) {
            imageUrl = data.data.image_url
          }
          else {
            throw new Error('响应中未找到图片URL')
          }
        }
        else {
          throw new Error(data.message || data.errorMessage || '即梦图片生成失败')
        }
      }
      else {
        // 其他AI服务的响应格式
        if (data.success && data.data && data.data.url) {
          imageUrl = data.data.url
        }
        else {
          throw new Error(data.message || '图片生成失败')
        }
      }
      
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
        props: { src: imageUrl },
        slideId: slideId
      })
      
      console.log(`✅ 图片生成成功: 幻灯片 ${targetSlideIndex} (${slideId}) 中的元素 ${targetElementId} 已更新`)
      
      addHistorySnapshot()
      loadingMessage.close() // 关闭加载消息
      message.success('图片生成成功！')
      return true // 返回成功状态
    }
    catch (error) {
      console.error('AI图片生成失败:', error)
      loadingMessage.close() // 关闭加载消息
      message.error('图片生成失败，请稍后重试')
      return false // 返回失败状态
    }
    finally {
      isGenerating.value = false
    }
  }

  return {
    isGenerating,
    generateAIImage,
  }
}
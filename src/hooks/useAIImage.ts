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

  const generateAIImage = async (prompt: string, model: string = 'jimeng') => {
    if (!handleElementId.value) {
      message.error('请先选择一个图片元素')
      return
    }

    const element = slidesStore.currentSlide.elements.find(el => el.id === handleElementId.value)
    if (!element || element.type !== 'image') {
      message.error('请选择一个图片元素')
      return
    }

    if (!prompt.trim()) {
      message.error('请输入图片描述')
      return
    }

    isGenerating.value = true
    message.success('正在生成图片，请稍候...', { duration: 0 })

    try {
      const response = await API.AI_Image({ prompt, model })
      const data = await response.json()
      
      let imageUrl = ''
      
      // 处理不同服务的响应格式
      if (model === 'jimeng') {
        // 火山引擎即梦服务的响应格式
        if (data.status === 'success' && data.image_url) {
          imageUrl = data.image_url
        }
        else {
          throw new Error(data.error_message || '即梦图片生成失败')
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
      
      if (imageUrl) {
        // 更新图片元素的src
        slidesStore.updateElement({
          id: handleElementId.value,
          props: { src: imageUrl }
        })
        
        addHistorySnapshot()
        message.success('图片生成成功！')
      }
      else {
        throw new Error('未获取到图片URL')
      }
    }
    catch (error) {
      console.error('AI图片生成失败:', error)
      message.error('图片生成失败，请稍后重试')
    }
    finally {
      isGenerating.value = false
      message.close()
    }
  }

  return {
    isGenerating,
    generateAIImage,
  }
}
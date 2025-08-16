import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import useAIDataSync from '@/hooks/useAIDataSync'

export const useAIDataProcessor = () => {
  const slidesStore = useSlidesStore()
  const { slides, slideIndex } = storeToRefs(slidesStore)
  
  // 启用 AI 数据同步
  useAIDataSync()
  
  // 获取当前幻灯片的 AI 数据
  const getCurrentSlideAIData = () => {
    const currentSlide = slides.value[slideIndex.value]
    return currentSlide?.aiData || null
  }
  
  // 更新当前幻灯片的 AI 数据
  const updateCurrentSlideAIData = (aiData: any) => {
    slidesStore.updateSlide({ aiData })
  }
  
  return {
    getCurrentSlideAIData,
    updateCurrentSlideAIData
  }
}
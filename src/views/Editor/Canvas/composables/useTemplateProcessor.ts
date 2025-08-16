import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'

// 记录每个幻灯片的互动模式状态
export const useSlideInteractiveStates = () => {
  const slidesStore = useSlidesStore()
  const { slideIndex, slides } = storeToRefs(slidesStore)
  
  const slideInteractiveStates = ref<Map<string, boolean>>(new Map())
  const isInteractiveTemplate = ref(false)
  
  // 管理幻灯片切换时的互动模式状态
  const handleSlideChange = (newIndex: number, oldIndex?: number) => {
    if (oldIndex !== undefined && slides.value[oldIndex]) {
      // 保存当前幻灯片的互动模式状态
      const oldSlideId = slides.value[oldIndex].id
      slideInteractiveStates.value.set(oldSlideId, isInteractiveTemplate.value)
    }
    
    if (slides.value[newIndex]) {
      // 恢复新幻灯片的互动模式状态
      const newSlideId = slides.value[newIndex].id
      const savedState = slideInteractiveStates.value.get(newSlideId)
      isInteractiveTemplate.value = savedState || false
    }
  }
  
  return {
    slideInteractiveStates,
    isInteractiveTemplate,
    handleSlideChange
  }
}
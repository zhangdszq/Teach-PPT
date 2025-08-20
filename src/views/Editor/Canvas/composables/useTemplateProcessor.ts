import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'

// 根据幻灯片类型自动判断是否为互动模板
export const useSlideInteractiveStates = () => {
  const slidesStore = useSlidesStore()
  const { slideIndex, slides } = storeToRefs(slidesStore)
  
  // 根据当前幻灯片的类型和属性自动判断是否为互动模板
  const isInteractiveTemplate = computed(() => {
    const currentSlide = slides.value[slideIndex.value]
    if (!currentSlide) return false
    
    // 检查幻灯片类型是否为 iframe 或者 isInteractive 属性为 true
    return currentSlide.type === 'iframe' || currentSlide.isInteractive === true
  })
  
  // 空的处理函数，保持接口兼容性
  const handleSlideChange = (newIndex: number, oldIndex?: number) => {
    // 不需要手动管理状态，由 computed 自动计算
  }
  
  return {
    isInteractiveTemplate,
    handleSlideChange
  }
}
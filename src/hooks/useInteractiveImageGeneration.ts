import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import useAIImageGenerator from '@/hooks/useAIImageGenerator'
import message from '@/utils/message'

/**
 * 互动模式图片生成 Hook
 * 专门处理互动模式下的 imgAlt 字段，使用统一的图片队列机制
 */
export default () => {
  const slidesStore = useSlidesStore()
  const { slideIndex, slides } = storeToRefs(slidesStore)
  
  // 使用统一的图片队列机制
  const {
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    processSlideImages,
    getManager,
    startImageGeneration
  } = useAIImageGenerator()
  
  // 为了保持向后兼容，创建别名
  const isProcessingInteractiveImages = isGeneratingImages

  // 规范化、解析 imageConfig（支持对象和字符串 例如: "1024x768"）
  const normalizeImageConfig = (cfg: any): { width: number; height: number } | null => {
    if (!cfg) return null
    try {
      if (typeof cfg === 'string') {
        const m = cfg.match(/^(\d+)\s*[xX]\s*(\d+)$/)
        if (m) return { width: Number(m[1]), height: Number(m[2]) }
        return null
      }
      if (typeof cfg === 'object') {
        const w = Number((cfg as any).width)
        const h = Number((cfg as any).height)
        if (!Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0) {
          return { width: w, height: h }
        }
      }
    } 
    catch (e) {
      // ignore parse errors
    }
    return null
  }

  // 获取幻灯片的有效 imageConfig
  // 优先级：slide.imageConfig -> aiData.interactiveData.imageConfig -> aiData.imageConfig -> templateData.imageConfig -> templateData.interactiveData.imageConfig
  const getEffectiveImageConfig = (slide: any): { width: number; height: number } | null => {
    const fromSlide = normalizeImageConfig(slide?.imageConfig)
    if (fromSlide) return fromSlide

    const fromAiInteractive = normalizeImageConfig(slide?.aiData?.interactiveData?.imageConfig)
    if (fromAiInteractive) return fromAiInteractive

    const fromAi = normalizeImageConfig(slide?.aiData?.imageConfig)
    if (fromAi) return fromAi

    const fromTemplate = normalizeImageConfig(slide?.templateData?.imageConfig)
    if (fromTemplate) return fromTemplate

    const fromTemplateInteractive = normalizeImageConfig(slide?.templateData?.interactiveData?.imageConfig)
    if (fromTemplateInteractive) return fromTemplateInteractive

    return null
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
          // 检查对应的 imgUrl 是否已经存在
          if (!obj.imgUrl || typeof obj.imgUrl !== 'string' || !obj.imgUrl.trim()) {
            console.log(`🎯 发现需要生成的互动图片 ${currentPath}:`, {
              imgAlt: value,
              imgUrl: obj.imgUrl,
              hasImgUrl: !!obj.imgUrl
            })
            return true
          }
          console.log(`⏭️ imgUrl 已存在 ${currentPath}:`, obj.imgUrl)
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
    if (!slide || !slide.templateData) {
      return 0
    }
    
    let count = 0
    const countImages = (obj: any) => {
      if (!obj || typeof obj !== 'object') return

      Object.keys(obj).forEach(key => {
        const value = obj[key]
        
        if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
          // 检查对应的 imgUrl 是否已经存在
          if (!obj.imgUrl || typeof obj.imgUrl !== 'string' || !obj.imgUrl.trim()) {
            count++
          }
        }
        else if (typeof value === 'object' && value !== null) {
          countImages(value)
        }
      })
    }

    countImages(slide.templateData)
    return count
  }

  return {
    // 状态
    isProcessingInteractiveImages,
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    
    // 方法
    hasInteractiveImages,
    getInteractiveImageCount,
    getEffectiveImageConfig
  }
}
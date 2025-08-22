import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import useAIPPT from '@/hooks/useAIPPT'
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
    addToImageQueue,
    startImageGeneration
  } = useAIPPT()
  
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
    } catch (e) {
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
   * 从模板数据中提取图片信息并添加到统一队列
   * @param templateData 模板数据
   * @param slideId 幻灯片ID
   * @param imageConfig 图片配置（可选）
   */
  const extractImagesFromTemplateData = (templateData: any, slideId: string, imageConfig?: { width: number; height: number }): void => {
    console.log('🔍 开始从模板数据中提取图片信息:', {
      templateData,
      slideId,
      imageConfig,
      hasImageConfig: !!imageConfig
    })

    if (!templateData || typeof templateData !== 'object') {
      console.log('❌ 模板数据无效，跳过图片提取')
      return
    }

    // 递归遍历模板数据，查找所有包含 imgAlt 的字段
    const extractImages = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') {
        console.log(`🔍 跳过非对象类型 ${path}:`, typeof obj)
        return
      }

      const keys = Object.keys(obj)
      console.log(`🔍 检查对象 ${path || 'root'}:`, {
        keys,
        keyCount: keys.length,
        obj: obj
      })

      keys.forEach(key => {
        const value = obj[key]
        const currentPath = path ? `${path}.${key}` : key
        
        console.log(`🔍 检查字段 ${currentPath}:`, {
          key,
          valueType: typeof value,
          isImgAlt: key === 'imgAlt',
          value: key === 'imgAlt' ? value : (typeof value === 'object' ? '[object]' : value)
        })

        if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
          console.log(`✅ 找到 imgAlt 字段 ${currentPath}:`, value)
          
          // 检查对应的 imgUrl 是否已经存在
          const current = obj
          let imgUrlExists = false
          
          // 检查同级的 imgUrl 字段
          if (current && current.imgUrl && typeof current.imgUrl === 'string' && current.imgUrl.trim()) {
            imgUrlExists = true
            console.log('⏭️ 跳过已有图片URL的元素:', {
              prompt: value.trim(),
              existingUrl: current.imgUrl,
              path: currentPath
            })
          }
          
          // 只有当 imgUrl 不存在或为空时才添加到生成队列
          if (!imgUrlExists) {
            // 使用传入的 imageConfig 或默认尺寸
            const normalized = normalizeImageConfig(imageConfig)
            const dimensions = normalized || { width: 400, height: 300 }
            
            console.log('🖼️ 发现互动模版图片生成需求:', {
              path: currentPath,
              prompt: value,
              dimensions,
              slideId
            })

            // 创建一个虚拟的图片元素用于统一队列处理
            const virtualElement = {
              id: `interactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'image' as const,
              width: dimensions.width,
              height: dimensions.height,
              left: 0,
              top: 0,
              rotate: 0,
              fixedRatio: true,
              src: '',
              alt: value,
              // 添加特殊标记表示这是互动模版图片
              isInteractiveTemplate: true,
              templateDataPath: path ? `${path}.imgUrl` : 'imgUrl'
            }

            console.log('📤 准备添加到图片生成队列:', {
              slideId,
              elementId: virtualElement.id,
              prompt: value,
              virtualElement
            })

            // 添加到统一的图片生成队列（与普通图片使用同一个队列）
            addToImageQueue(slideId, virtualElement.id, value, virtualElement)
            console.log('✅ 已添加到图片生成队列')
          }
        }
        else if (typeof value === 'object' && value !== null) {
          console.log(`🔄 递归处理嵌套对象 ${currentPath}`)
          // 递归处理嵌套对象
          extractImages(value, currentPath)
        }
      })
    }

    extractImages(templateData)
    console.log('✅ 互动模版图片提取完成，已添加到统一队列')
  }

  /**
   * 将互动模版图片添加到统一的图片队列
   */
  const addInteractiveImagesToQueue = (slide: any): void => {
    const effectiveImageCfg = getEffectiveImageConfig(slide)

    console.log('📋 开始将互动图片添加到队列:', {
      slideId: slide.id,
      hasTemplateData: !!slide.templateData,
      hasImageConfig: !!effectiveImageCfg,
      rawImageConfig: slide.imageConfig,
      aiDataImageConfig: slide?.aiData?.interactiveData?.imageConfig,
      templateDataImageConfig: slide?.templateData?.imageConfig,
      effectiveImageCfg,
      templateData: slide.templateData
    })
    
    if (!slide.templateData) {
      console.log('❌ 幻灯片没有模板数据，跳过图片提取')
      return
    }
    
    console.log('🔄 调用 extractImagesFromTemplateData 提取图片')
    // 直接调用 extractImagesFromTemplateData，它会自动添加到队列
    extractImagesFromTemplateData(slide.templateData, slide.id, effectiveImageCfg || undefined)
    console.log('✅ extractImagesFromTemplateData 调用完成')
  }

  /**
   * 处理互动模式图片生成
   * @param slideIndex 幻灯片索引
   */
  const processInteractiveImages = async (slideIndex: number, slideData?: any) => {
    try {
      console.log('🎮 开始处理互动模式图片生成:', {
        slideIndex,
        totalSlides: slides.value.length,
        hasSlideData: !!slideData,
        slideDataKeys: slideData ? Object.keys(slideData) : null
      })

      if (slideIndex < 0 || slideIndex >= slides.value.length) {
        console.error('❌ 无效的幻灯片索引:', slideIndex)
        return
      }

      const slide = slideData || slides.value[slideIndex]
      if (!slide) {
        console.error('❌ 找不到指定的幻灯片:', slideIndex)
        return
      }

      console.log('📊 使用的幻灯片数据:', {
        slideId: slide.id,
        hasTemplateData: !!slide.templateData,
        templateDataKeys: slide.templateData ? Object.keys(slide.templateData) : null,
        isInteractive: slide.isInteractive,
        slideSource: slideData ? 'provided slideData' : 'slides store'
      })

      // 检查是否有互动图片需要生成
      const hasImages = hasInteractiveImages(slide)
      console.log('🔍 互动图片检查结果:', hasImages)
      
      if (!hasImages) {
        console.log('ℹ️ 当前幻灯片没有需要生成的互动图片')
        return
      }

      // 提取需要生成图片的元素并添加到队列
      const targetSlide = slide
      const effectiveImageCfg = getEffectiveImageConfig(targetSlide)
      console.log('📝 准备添加到队列的幻灯片:', {
        slideId: targetSlide.id,
        hasTemplateData: !!targetSlide.templateData,
        hasImageConfig: !!effectiveImageCfg,
        effectiveImageCfg
      })
      
      addInteractiveImagesToQueue(targetSlide)
      console.log('✅ 已添加互动图片到生成队列')
      
      // 启动统一的图片生成队列处理
      console.log('🚀 启动图片生成队列处理')
      await startImageGeneration()
      
      console.log('✅ 互动模式图片生成处理完成')
    }
    catch (error) {
      console.error('❌ 处理互动模式图片生成失败:', error)
      message.error('处理互动模式图片生成失败: ' + (error as Error).message)
    }
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
    processInteractiveImages,
    addInteractiveImagesToQueue,
    hasInteractiveImages,
    getInteractiveImageCount,
    extractImagesFromTemplateData
  }
}
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { aiImageService } from '@/services/aiImageService'
import message from '@/utils/message'

/**
 * 互动模式图片生成 Hook
 * 专门处理互动模式下的 imgAlt 字段，调用 AI 生成图片并更新 imgURL
 */
export default () => {
  const slidesStore = useSlidesStore()
  const { slideIndex, slides } = storeToRefs(slidesStore)
  
  const isProcessingInteractiveImages = ref(false)
  const processedImageCount = ref(0)
  const totalImageCount = ref(0)

  /**
   * 处理互动模式下的图片生成
   * 从 templateData 中提取 imgAlt 字段，生成图片后更新 imgURL
   */
  const processInteractiveImages = async (targetSlideIndex?: number) => {
    try {
      if (isProcessingInteractiveImages.value) {
        message.warning('正在处理互动图片，请稍候...')
        return
      }

      const currentSlideIndex = targetSlideIndex !== undefined ? targetSlideIndex : slideIndex.value
      const slide = slides.value[currentSlideIndex]
      
      if (!slide) {
        console.error(`❌ 幻灯片不存在: 索引 ${currentSlideIndex}`)
        message.error('当前幻灯片不存在')
        return
      }

      if (!slide.isInteractive || !slide.templateData) {
        console.log('📄 当前幻灯片不是互动模式或没有模板数据')
        return
      }

      console.log('🎮 开始处理互动模式图片生成:', {
        slideIndex: currentSlideIndex,
        slideId: slide.id,
        hasTemplateData: !!slide.templateData
      })

      // 提取需要生成图片的元素
      const imagesToGenerate = extractImagesFromTemplateData(slide.templateData)
      
      if (imagesToGenerate.length === 0) {
        console.log('📷 未找到需要生成的图片')
        message.info('当前互动模板中没有需要生成的图片')
        return
      }

      isProcessingInteractiveImages.value = true
      totalImageCount.value = imagesToGenerate.length
      processedImageCount.value = 0

      console.log(`🚀 开始处理 ${imagesToGenerate.length} 个互动图片`)
      message.success(`开始生成 ${imagesToGenerate.length} 个互动图片，请稍候...`, { duration: 3 })

      // 并发处理图片生成
      const promises = imagesToGenerate.map(async (imageInfo, index) => {
        try {
          console.log(`🎨 生成第 ${index + 1} 个图片:`, imageInfo)
          
          // 调用 AI 生成图片
          const imageUrl = await generateImageFromPrompt(imageInfo.prompt)
          
          if (imageUrl) {
            // 更新 templateData 中的 imgURL
            updateImageUrlInTemplateData(slide, imageInfo.path, imageUrl)
            processedImageCount.value++
            
            console.log(`✅ 第 ${index + 1} 个图片生成成功:`, imageUrl)
          }
          else {
            console.error(`❌ 第 ${index + 1} 个图片生成失败`)
          }
        }
        catch (error) {
          console.error(`💥 第 ${index + 1} 个图片生成异常:`, error)
        }
      })

      await Promise.all(promises)

      console.log(`🎉 互动图片生成完成: ${processedImageCount.value}/${totalImageCount.value}`)
      message.success(`互动图片生成完成！成功生成 ${processedImageCount.value} 个图片`)

    }
    catch (error) {
      console.error('❌ 互动图片生成失败:', error)
      message.error('互动图片生成失败，请稍后重试')
    }
    finally {
      isProcessingInteractiveImages.value = false
    }
  }

  /**
   * 从 templateData 中提取需要生成图片的信息
   */
  const extractImagesFromTemplateData = (templateData: any): Array<{prompt: string, path: string}> => {
    const imagesToGenerate: Array<{prompt: string, path: string}> = []
    
    try {
      // 递归遍历 templateData 查找 imgAlt 字段
      const findImagesRecursive = (obj: any, currentPath: string = '') => {
        if (typeof obj !== 'object' || obj === null) return
        
        for (const [key, value] of Object.entries(obj)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key
          
          if (key === 'imgAlt' && typeof value === 'string' && value.trim()) {
            // 找到 imgAlt 字段，检查是否有对应的 imgUrl 字段
            const parentPath = currentPath
            const imgUrlPath = parentPath ? `${parentPath}.imgUrl` : 'imgUrl'
            
            // 检查对应的 imgUrl 是否已经存在
            let current = templateData
            let imgUrlExists = false
            
            // 从根对象开始导航到 imgUrl 位置
            if (parentPath) {
              const parentParts = parentPath.split('.')
              for (const part of parentParts) {
                if (current && current[part]) {
                  current = current[part]
                }
                else {
                  current = null
                  break
                }
              }
            }
            
            // 检查 imgUrl 是否存在且有值
            if (current && current.imgUrl && typeof current.imgUrl === 'string' && current.imgUrl.trim()) {
              imgUrlExists = true
              console.log('⏭️ 跳过已有图片URL的元素:', {
                prompt: value.trim(),
                existingUrl: current.imgUrl,
                path: imgUrlPath
              })
            }
            
            // 只有当 imgUrl 不存在或为空时才添加到生成队列
            if (!imgUrlExists) {
              imagesToGenerate.push({
                prompt: value.trim(),
                path: imgUrlPath
              })
              
              console.log('🔍 发现需要生成的图片:', {
                prompt: value.trim(),
                path: imgUrlPath
              })
            }
          }
          else if (typeof value === 'object') {
            findImagesRecursive(value, newPath)
          }
        }
      }
      
      findImagesRecursive(templateData)
      
    }
    catch (error) {
      console.error('❌ 提取图片信息失败:', error)
    }
    
    return imagesToGenerate
  }

  /**
   * 调用 AI 生成图片
   */
  const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
    const result = await aiImageService.generateImage({
      prompt,
      model: 'jimeng',
      width: 800,
      height: 600
    })
    
    return result.success ? result.imageUrl || null : null
  }

  /**
   * 更新 templateData 中指定路径的 imgURL
   */
  const updateImageUrlInTemplateData = (slide: any, path: string, imageUrl: string) => {
    try {
      const pathParts = path.split('.')
      let current = slide.templateData
      
      // 导航到目标对象
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (current[pathParts[i]] === undefined) {
          current[pathParts[i]] = {}
        }
        current = current[pathParts[i]]
      }
      
      // 设置 imgURL
      const finalKey = pathParts[pathParts.length - 1]
      current[finalKey] = imageUrl
      
      // 更新幻灯片数据
      slidesStore.updateSlide({
        templateData: { ...slide.templateData }
      })
      
      console.log(`🔄 已更新图片URL: ${path} = ${imageUrl}`)
      
    }
    catch (error) {
      console.error('❌ 更新图片URL失败:', error)
    }
  }

  /**
   * 检查当前幻灯片是否有需要生成的互动图片
   */
  const hasInteractiveImages = (targetSlideIndex?: number): boolean => {
    const currentSlideIndex = targetSlideIndex !== undefined ? targetSlideIndex : slideIndex.value
    const slide = slides.value[currentSlideIndex]
    
    if (!slide || !slide.isInteractive || !slide.templateData) {
      return false
    }
    
    const images = extractImagesFromTemplateData(slide.templateData)
    return images.length > 0
  }

  /**
   * 获取需要生成的互动图片数量
   */
  const getInteractiveImageCount = (targetSlideIndex?: number): number => {
    const currentSlideIndex = targetSlideIndex !== undefined ? targetSlideIndex : slideIndex.value
    const slide = slides.value[currentSlideIndex]
    
    if (!slide || !slide.isInteractive || !slide.templateData) {
      return 0
    }
    
    const images = extractImagesFromTemplateData(slide.templateData)
    return images.length
  }

  return {
    isProcessingInteractiveImages,
    processedImageCount,
    totalImageCount,
    processInteractiveImages,
    hasInteractiveImages,
    getInteractiveImageCount
  }
}
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import type { ImageClipDataRange, PPTElement, PPTImageElement, PPTShapeElement, PPTTextElement, Slide, TextType } from '@/types/slides'
import type { AIPPTSlide } from '@/types/AIPPT'
import { useSlidesStore } from '@/store'
import useAddSlidesOrElements from './useAddSlidesOrElements'
import useSlideHandler from './useSlideHandler'
import { aiImageService } from '@/services/aiImageService'
import message from '@/utils/message'

interface ImgPoolItem {
  id: string
  src: string
  width: number
  height: number
}

export default () => {
  const slidesStore = useSlidesStore()
  const { addSlidesFromData } = useAddSlidesOrElements()
  const { isEmptySlide } = useSlideHandler()

  const imgPool = ref<ImgPoolItem[]>([])
  const transitionIndex = ref(0)
  const transitionTemplate = ref<Slide | null>(null)

  // 图片生成队列相关状态
  const isGeneratingImages = ref(false)
  const imageGenerationProgress = ref(0)
  const totalImageCount = ref(0)
  const processedImageCount = ref(0)
  const imageGenerationQueue = ref<Array<{
    slideId: string
    elementId: string
    prompt: string
    element: PPTImageElement
  }>>([])

  const checkTextType = (el: PPTElement, type: TextType) => {
    return (el.type === 'text' && el.textType === type) || (el.type === 'shape' && el.text && el.text.type === type)
  }
  
  const getUseableTemplates = (templates: Slide[], n: number, type: TextType) => {
    if (n === 1) {
      const list = templates.filter(slide => {
        const items = slide.elements.filter(el => checkTextType(el, type))
        const titles = slide.elements.filter(el => checkTextType(el, 'title'))
        const texts = slide.elements.filter(el => checkTextType(el, 'content'))
  
        return !items.length && titles.length === 1 && texts.length === 1
      })
  
      if (list.length) return list
    }
  
    let target: Slide | null = null
  
    const list = templates.filter(slide => {
      const len = slide.elements.filter(el => checkTextType(el, type)).length
      return len >= n
    })
    if (list.length === 0) {
      const sorted = templates.sort((a, b) => {
        const aLen = a.elements.filter(el => checkTextType(el, type)).length
        const bLen = b.elements.filter(el => checkTextType(el, type)).length
        return aLen - bLen
      })
      target = sorted[sorted.length - 1]
    }
    else {
      target = list.reduce((closest, current) => {
        const currentLen = current.elements.filter(el => checkTextType(el, type)).length
        const closestLen = closest.elements.filter(el => checkTextType(el, type)).length
        return (currentLen - n) <= (closestLen - n) ? current : closest
      })
    }
  
    return templates.filter(slide => {
      const len = slide.elements.filter(el => checkTextType(el, type)).length
      const targetLen = target!.elements.filter(el => checkTextType(el, type)).length
      return len === targetLen
    })
  }
  
  const getAdaptedFontsize = ({
    text,
    fontSize,
    fontFamily,
    width,
    maxLine,
  }: {
    text: string
    fontSize: number
    fontFamily: string
    width: number
    maxLine: number
  }) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
  
    let newFontSize = fontSize
    const minFontSize = 10
  
    while (newFontSize >= minFontSize) {
      context.font = `${newFontSize}px ${fontFamily}`
      const textWidth = context.measureText(text).width
      const line = Math.ceil(textWidth / width)
  
      if (line <= maxLine) return newFontSize
  
      const step = newFontSize <= 22 ? 1 : 2
      newFontSize = newFontSize - step
    }
  
    return minFontSize
  }
  
  const getFontInfo = (htmlString: string) => {
    const fontSizeRegex = /font-size:\s*(\d+(?:\.\d+)?)\s*px/i
    const fontFamilyRegex = /font-family:\s*['"]?([^'";]+)['"]?\s*(?=;|>|$)/i
  
    const defaultInfo = {
      fontSize: 16,
      fontFamily: 'Microsoft Yahei',
    }
  
    const fontSizeMatch = htmlString.match(fontSizeRegex)
    const fontFamilyMatch = htmlString.match(fontFamilyRegex)
  
    return {
      fontSize: fontSizeMatch ? (+fontSizeMatch[1].trim()) : defaultInfo.fontSize,
      fontFamily: fontFamilyMatch ? fontFamilyMatch[1].trim() : defaultInfo.fontFamily,
    }
  }
  
  const getNewTextElement = ({
    el,
    text,
    maxLine,
    longestText,
    digitPadding,
  }: {
    el: PPTTextElement | PPTShapeElement
    text: string
    maxLine: number
    longestText?: string
    digitPadding?: boolean
  }): PPTTextElement | PPTShapeElement => {
    const padding = 10
    const width = el.width - padding * 2 - 2
  
    let content = el.type === 'text' ? el.content : el.text!.content
  
    const fontInfo = getFontInfo(content)
    const size = getAdaptedFontsize({
      text: longestText || text,
      fontSize: fontInfo.fontSize,
      fontFamily: fontInfo.fontFamily,
      width,
      maxLine,
    })
  
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
  
    const treeWalker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  
    const firstTextNode = treeWalker.nextNode()
    if (firstTextNode) {
      if (digitPadding && firstTextNode.textContent && firstTextNode.textContent.length === 2 && text.length === 1) {
        firstTextNode.textContent = '0' + text
      }
      else firstTextNode.textContent = text
    }
  
    if (doc.body.innerHTML.indexOf('font-size') === -1) {
      const p = doc.querySelector('p')
      if (p) p.style.fontSize = '16px'
    }
  
    content = doc.body.innerHTML.replace(/font-size:(.+?)px/g, `font-size: ${size}px`)
  
    return el.type === 'text' ? { ...el, content, lineHeight: size < 15 ? 1.2 : el.lineHeight } : { ...el, text: { ...el.text!, content } }
  }

  const getUseableImage = (el: PPTImageElement): ImgPoolItem | null => {
    let img: ImgPoolItem | null = null
  
    let imgs = []
  
    if (el.width === el.height) imgs = imgPool.value.filter(img => img.width === img.height)
    else if (el.width > el.height) imgs = imgPool.value.filter(img => img.width > img.height)
    else imgs = imgPool.value.filter(img => img.width <= img.height)
    if (!imgs.length) imgs = imgPool.value
  
    img = imgs[Math.floor(Math.random() * imgs.length)]
    imgPool.value = imgPool.value.filter(item => item.id !== img!.id)
  
    return img
  }
  
  const getNewImgElement = (el: PPTImageElement): PPTImageElement => {
    const img = getUseableImage(el)
    if (!img) return el
  
    let scale = 1
    let w = el.width
    let h = el.height
    let range: ImageClipDataRange = [[0, 0], [0, 0]]
    const radio = el.width / el.height
    if (img.width / img.height >= radio) {
      scale = img.height / el.height
      w = img.width / scale
      const diff = (w - el.width) / 2 / w * 100
      range = [[diff, 0], [100 - diff, 100]]
    }
    else {
      scale = img.width / el.width
      h = img.height / scale
      const diff = (h - el.height) / 2 / h * 100
      range = [[0, diff], [100, 100 - diff]]
    }
    const clipShape = (el.clip && el.clip.shape) ? el.clip.shape : 'rect'
    const clip = { range, shape: clipShape }
    const src = img.src
  
    return { ...el, src, clip }
  }
  
  const getMdContent = (content: string) => {
    const regex = /```markdown([^```]*)```/
    const match = content.match(regex)
    if (match) return match[1].trim()
    return content.replace('```markdown', '').replace('```', '')
  }
  
  const getJSONContent = (content: string) => {
    const regex = /```json([^```]*)```/
    const match = content.match(regex)
    if (match) return match[1].trim()
    return content.replace('```json', '').replace('```', '')
  }

  const presetImgPool = (imgs: ImgPoolItem[]) => {
    imgPool.value = imgs
  }

  /**
   * 添加图片到生成队列
   */
  const addToImageQueue = (slideId: string, elementId: string, prompt: string, element: PPTImageElement) => {
    imageGenerationQueue.value.push({
      slideId,
      elementId,
      prompt,
      element
    })
  }

  /**
   * 处理图片生成队列
   * @param concurrency 并发数，默认为2
   */
  const processImageQueue = async (concurrency: number = 2) => {
    // 如果队列为空，直接返回
    if (imageGenerationQueue.value.length === 0) {
      console.log('⚠️ 队列为空，无需处理')
      return
    }

    // 如果正在生成图片，直接返回，避免重复处理
    if (isGeneratingImages.value) {
      console.log('⏳ 检测到正在生成图片，当前队列将被合并处理')
      return
    }

    console.log(`🚀 开始处理图片生成队列，共 ${imageGenerationQueue.value.length} 个任务`)
    
    isGeneratingImages.value = true
    totalImageCount.value = imageGenerationQueue.value.length
    processedImageCount.value = 0
    imageGenerationProgress.value = 0

    let currentLoadingMessage = message.success(
      `正在为 ${totalImageCount.value} 个图片元素生成AI图片，请稍候...`,
      { duration: 0 }
    )
    
    // 记录开始时间
    const startTime = Date.now()

    // 创建进度更新定时器
    const progressTimer = setInterval(() => {
      if (currentLoadingMessage && processedImageCount.value < totalImageCount.value) {
        currentLoadingMessage.close()
        const progress = Math.round((processedImageCount.value / totalImageCount.value) * 100)
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000)
        const estimatedTotal = totalImageCount.value > 0 ? Math.floor(elapsedTime / processedImageCount.value * totalImageCount.value) : 0
        const remainingTime = Math.max(0, estimatedTotal - elapsedTime)
        
        let timeStr = ''
        if (remainingTime > 60) {
          const minutes = Math.floor(remainingTime / 60)
          const seconds = remainingTime % 60
          timeStr = ` (预计剩余 ${minutes}分${seconds}秒)`
        } else if (remainingTime > 0) {
          timeStr = ` (预计剩余 ${remainingTime}秒)`
        }
        
        currentLoadingMessage = message.success(
          `正在生成图片 ${processedImageCount.value}/${totalImageCount.value} (${progress}%)${timeStr}`,
          { duration: 0 }
        )
        imageGenerationProgress.value = progress
      }
    }, 1000)

    try {
      // 复制队列，但不立即清空原队列，等处理完成后再清空
      const queue = [...imageGenerationQueue.value]
      console.log(`📋 复制队列完成，开始分批处理，并发数: ${concurrency}`)

      let successCount = 0
      let failureCount = 0

      // 分批处理，每批并发处理指定数量
      for (let i = 0; i < queue.length; i += concurrency) {
        const batch = queue.slice(i, i + concurrency)
        const batchNumber = Math.floor(i / concurrency) + 1
        const totalBatches = Math.ceil(queue.length / concurrency)
        console.log(`🔄 处理第 ${batchNumber}/${totalBatches} 批，包含 ${batch.length} 个任务`)
        
        // 并发处理当前批次
        const batchPromises = batch.map(async (item, batchIndex) => {
          const globalIndex = i + batchIndex + 1
          
          // 查找幻灯片索引以便在进度中显示
          const slideIndex = slidesStore.slides.findIndex(s => s.id === item.slideId) + 1
          
          try {
            console.log('============================================')
            console.log(`🖼️ [${globalIndex}/${queue.length}] 开始生成图片`)
            console.log(`📍 位置: 第 ${slideIndex} 张幻灯片`)
            console.log(`🎯 目标: 幻灯片ID: ${item.slideId}, 元素ID: ${item.elementId}`)
            console.log(`💬 提示词: "${item.prompt}"`)
            
            const success = await generateImageForElement(item.element, item.prompt, item.slideId, item.elementId)
            processedImageCount.value++
            
            if (success) {
              successCount++
              console.log(`✅ [${globalIndex}/${queue.length}] 图片生成成功!`)
            }
            else {
              failureCount++
              console.log(`❌ [${globalIndex}/${queue.length}] 图片生成失败`)
            }
            
            return { success, item, index: globalIndex, slideIndex }
          }
          catch (error) {
            processedImageCount.value++
            failureCount++
            console.error(`❌ [${globalIndex}/${queue.length}] 图片生成异常:`, error)
            return { success: false, item, error, index: globalIndex, slideIndex }
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        console.log(`📊 第 ${Math.floor(i / concurrency) + 1} 批处理完成，结果:`, batchResults.map(r => r.status))
        
        // 如果不是最后一批，稍微延迟避免请求过于密集
        if (i + concurrency < queue.length) {
          // 根据失败率动态调整延迟
          const failureRate = failureCount / (successCount + failureCount)
          const delay = failureRate > 0.3 ? 2000 : 500 // 失败率高于30%时增加延迟
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      // 处理完成后清空已处理的队列
      imageGenerationQueue.value = []
      console.log(`🎊 当前批次处理完成! 成功: ${successCount}, 失败: ${failureCount}`)
      
      console.log(`✨ 所有图片生成任务已完成!`)

      // 清除进度定时器
      clearInterval(progressTimer)

      // 关闭loading消息
      if (currentLoadingMessage) {
        currentLoadingMessage.close()
      }

      // 计算总耗时
      const totalTime = Math.floor((Date.now() - startTime) / 1000)
      const timeStr = totalTime > 60 ? 
        `${Math.floor(totalTime / 60)}分${totalTime % 60}秒` : 
        `${totalTime}秒`
      
      // 显示完成消息
      if (successCount > 0) {
        message.success(`成功生成 ${successCount} 张AI图片！${failureCount > 0 ? ` (${failureCount} 张失败)` : ''} 耗时${timeStr}`)
      }
      else if (failureCount > 0) {
        message.error(`图片生成失败，共 ${failureCount} 张图片未能生成`)
      }

    }
    catch (error) {
      console.error('❌ 批量生成图片失败:', error)
      clearInterval(progressTimer)
      if (currentLoadingMessage) {
        currentLoadingMessage.close()
      }
      message.error('图片生成过程中出现错误: ' + (error as Error).message)
    }
    finally {
      isGeneratingImages.value = false
      processedImageCount.value = 0
      totalImageCount.value = 0
      imageGenerationProgress.value = 0
      console.log('🔚 图片生成队列处理结束')
    }
  }

  /**
   * 为单个图片元素生成AI图片
   * @param element 图片元素
   * @param prompt AI生成提示词
   * @param targetSlideId 目标幻灯片ID
   * @param targetElementId 目标元素ID
   * @param retryCount 当前重试次数
   * @param maxRetries 最大重试次数
   */
  const generateImageForElement = async (
    element: PPTImageElement, 
    prompt: string, 
    targetSlideId: string, 
    targetElementId: string,
    retryCount: number = 0,
    maxRetries: number = 2
  ): Promise<boolean> => {
    try {
      console.log(`🎨 开始为元素 ${targetElementId} 生成图片，提示词: "${prompt}"`)
      console.log(`🎯 目标幻灯片: ${targetSlideId}`)
      console.log(`📐 图片尺寸: ${element.width || 800}x${element.height || 600}`)
      
      // 设置超时（根据重试次数增加超时时间）
      const timeout = 30000 + (retryCount * 10000) // 30秒 + 每次重试10秒
      
      // 使用统一的 AI 图片生成服务
      const response = await aiImageService.generateImage({
        prompt,
        model: 'jimeng',
        width: element.width || 800,
        height: element.height || 600
      })
      
      if (!response.success || !response.imageUrl) {
        throw new Error(response.error || '图片生成失败')
      }
      
      const imageUrl = response.imageUrl
      
      if (imageUrl) {
        console.log(`🔄 更新元素 ${targetElementId} 的图片URL: ${imageUrl}`)
        console.log(`🎯 目标幻灯片ID: ${targetSlideId}`)
        
        // 验证目标幻灯片和元素是否存在
        const targetSlide = slidesStore.slides.find(slide => slide.id === targetSlideId)
        if (!targetSlide) {
          console.error(`❌ 未找到目标幻灯片: ${targetSlideId}`)
          return false
        }
        
        const targetElement = targetSlide.elements.find(el => el.id === targetElementId)
        if (!targetElement) {
          console.error(`❌ 在幻灯片 ${targetSlideId} 中未找到元素: ${targetElementId}`)
          console.log('🔍 该幻灯片的所有元素ID:', targetSlide.elements.map(el => el.id))
          return false
        }
        
        // 精确更新指定幻灯片中的指定元素
        slidesStore.updateElement({
          id: targetElementId,
          props: { src: imageUrl },
          slideId: targetSlideId
        })
        
        console.log(`✅ 元素 ${targetElementId} 在幻灯片 ${targetSlideId} 中图片更新成功`)
        console.log(`🖼️ 图片URL: ${imageUrl}`)
        return true
      }
      
      throw new Error('未获取到图片URL')
    }
    catch (error: any) {
      console.error(`❌ 为元素 ${targetElementId} 生成图片失败:`, error)
      console.error(`❌ 失败的提示词: "${prompt}"`)
      console.error(`❌ 错误详情:`, error)
      
      // 判断是否可以重试
      const isRetryableError = 
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.message?.includes('HTTP 5') ||
        error.message?.includes('HTTP 429') || // Rate limit
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT'
      
      if (isRetryableError && retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000) // 指数退避，最多5秒
        console.log(`🔄 将在 ${retryDelay}ms 后重试第 ${retryCount + 1}/${maxRetries} 次...`)
        
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        
        // 递归重试
        return generateImageForElement(
          element, 
          prompt, 
          targetSlideId, 
          targetElementId, 
          retryCount + 1, 
          maxRetries
        )
      }
      
      // 不重新抛出错误，而是返回false，让调用方处理
      return false
    }
  }

  /**
   * 收集幻灯片中需要AI生成图片的元素并添加到队列
   * 支持从整个slides store或指定的幻灯片数组收集
   */
  const collectAndQueueImages = (slides?: Slide[]) => {
    // 如果没有传入slides，从store获取所有幻灯片
    const targetSlides = slides || slidesStore.slides
    console.log('🔍 开始收集图片元素，幻灯片数量:', targetSlides.length)
    
    // 清空现有队列
    imageGenerationQueue.value = []
    
    let totalImageElements = 0
    let skippedElements = 0
    
    targetSlides.forEach((slide, slideIndex) => {
      console.log('============================================')
      console.log(`📄 检查第 ${slideIndex + 1} 张幻灯片 (ID: ${slide.id})，元素数量: ${slide.elements.length}`)
      
      const imageElements = slide.elements.filter(el => el.type === 'image')
      totalImageElements += imageElements.length
      console.log(`🖼️ 找到 ${imageElements.length} 个图片元素`)
      
      imageElements.forEach((element, elementIndex) => {
        const imgElement = element as PPTImageElement
        console.log(`🔍 检查图片元素 ${elementIndex + 1}:`, {
          id: imgElement.id,
          type: imgElement.type,
          hasAlt: !!imgElement.alt,
          alt: imgElement.alt,
          hasSrc: !!imgElement.src,
          src: imgElement.src?.substring(0, 50) + '...'
        })
        
        // 检查是否需要AI生成图片的条件：
        // 1. 必须有alt属性且不为空
        // 2. alt不是特殊标记（如REMOVE_THIS_ELEMENT）
        // 3. 可选：检查是否已有有效的src（可配置是否重新生成）
        const hasValidAlt = imgElement.alt && imgElement.alt.trim() && imgElement.alt !== 'REMOVE_THIS_ELEMENT'
        const hasValidSrc = imgElement.src && !imgElement.src.includes('placeholder') && !imgElement.src.includes('default') && !imgElement.src.startsWith('data:image/svg')
        
        // 只要有有效的alt就加入队列（即使已有src，也可能需要更新）
        const needsAIGeneration = hasValidAlt
        
        if (needsAIGeneration) {
          console.log(`✅ 添加到AI生成队列: "${imgElement.alt}" (${hasValidSrc ? '将替换现有图片' : '新图片'})`)
          addToImageQueue(slide.id, imgElement.id, imgElement.alt!.trim(), imgElement)
        }
        else {
          skippedElements++
          console.log(`❌ 跳过图片元素，原因:`, {
            hasValidAlt,
            alt: imgElement.alt || '(无alt属性)',
            reason: !imgElement.alt ? '缺少alt属性' : 
                   !imgElement.alt.trim() ? 'alt属性为空' : 
                   imgElement.alt === 'REMOVE_THIS_ELEMENT' ? '特殊标记元素' : '其他'
          })
        }
      })
    })
    
    // 更新总数计数器
    totalImageCount.value = imageGenerationQueue.value.length
    processedImageCount.value = 0
    
    console.log('============================================')
    console.log(`📊 收集完成统计:`)
    console.log(`  - 总幻灯片数: ${targetSlides.length}`)
    console.log(`  - 总图片元素数: ${totalImageElements}`)
    console.log(`  - 需要生成的图片数: ${imageGenerationQueue.value.length}`)
    console.log(`  - 跳过的图片数: ${skippedElements}`)
    console.log(`  - 队列详情:`, imageGenerationQueue.value.map(item => ({
      slide: item.slideId,
      element: item.elementId,
      prompt: item.prompt
    })))
  }

  /**
   * 启动图片生成队列处理
   */
  const startImageGeneration = async () => {
    console.log(`🎬 启动图片生成队列处理，当前队列长度: ${imageGenerationQueue.value.length}`)
    
    if (imageGenerationQueue.value.length === 0) {
      console.log('📭 队列为空，无需启动处理')
      return
    }
    
    if (!isGeneratingImages.value) {
      console.log(`🚀 立即开始处理 ${imageGenerationQueue.value.length} 个图片生成任务`)
      await processImageQueue(2) // 每次并发处理2个图片
    } else {
      console.log('⏳ 检测到正在生成图片，新任务将在当前任务完成后处理')
    }
  }

  const AIPPT = (templateSlides: Slide[], _AISlides: AIPPTSlide[], imgs?: ImgPoolItem[]) => {
    slidesStore.updateSlideIndex(slidesStore.slides.length - 1)

    if (imgs) imgPool.value = imgs

    const AISlides: AIPPTSlide[] = []
    for (const template of _AISlides) {
      if (template.type === 'content') {
        const items = template.data.items
        if (items.length === 5 || items.length === 6) {
          const items1 = items.slice(0, 3)
          const items2 = items.slice(3)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 3 })
        }
        else if (items.length === 7 || items.length === 8) {
          const items1 = items.slice(0, 4)
          const items2 = items.slice(4)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 4 })
        }
        else if (items.length === 9 || items.length === 10) {
          const items1 = items.slice(0, 3)
          const items2 = items.slice(3, 6)
          const items3 = items.slice(6)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 3 })
          AISlides.push({ ...template, data: { ...template.data, items: items3 }, offset: 6 })
        }
        else if (items.length > 10) {
          const items1 = items.slice(0, 4)
          const items2 = items.slice(4, 8)
          const items3 = items.slice(8)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 4 })
          AISlides.push({ ...template, data: { ...template.data, items: items3 }, offset: 8 })
        }
        else {
          AISlides.push(template)
        }
      }
      else if (template.type === 'contents') {
        const items = template.data.items
        if (items.length === 11) {
          const items1 = items.slice(0, 6)
          const items2 = items.slice(6)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 6 })
        }
        else if (items.length > 11) {
          const items1 = items.slice(0, 10)
          const items2 = items.slice(10)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 10 })
        }
        else {
          AISlides.push(template)
        }
      }
      else AISlides.push(template)
    }

    const coverTemplates = templateSlides.filter(slide => slide.type === 'cover')
    const contentsTemplates = templateSlides.filter(slide => slide.type === 'contents')
    const transitionTemplates = templateSlides.filter(slide => slide.type === 'transition')
    const contentTemplates = templateSlides.filter(slide => slide.type === 'content')
    const endTemplates = templateSlides.filter(slide => slide.type === 'end')

    if (!transitionTemplate.value) {
      const _transitionTemplate = transitionTemplates[Math.floor(Math.random() * transitionTemplates.length)]
      transitionTemplate.value = _transitionTemplate
    }

    const slides = []
    
    for (const item of AISlides) {
      if (item.type === 'cover') {
        const coverTemplate = coverTemplates[Math.floor(Math.random() * coverTemplates.length)]
        const elements = coverTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          if (checkTextType(el, 'content') && item.data.text) {
            return getNewTextElement({ el, text: item.data.text, maxLine: 3 })
          }
          return el
        })
        slides.push({
          ...coverTemplate,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'contents') {
        const _contentsTemplates = getUseableTemplates(contentsTemplates, item.data.items.length, 'item')
        const contentsTemplate = _contentsTemplates[Math.floor(Math.random() * _contentsTemplates.length)]

        const sortedNumberItems = contentsTemplate.elements.filter(el => checkTextType(el, 'itemNumber'))
        const sortedNumberItemIds = sortedNumberItems.sort((a, b) => {
          if (sortedNumberItems.length > 6) {
            let aContent = ''
            let bContent = ''
            if (a.type === 'text') aContent = a.content
            if (a.type === 'shape') aContent = a.text!.content
            if (b.type === 'text') bContent = b.content
            if (b.type === 'shape') bContent = b.text!.content

            if (aContent && bContent) {
              const aIndex = parseInt(aContent)
              const bIndex = parseInt(bContent)

              return aIndex - bIndex
            }
          }
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedItems = contentsTemplate.elements.filter(el => checkTextType(el, 'item'))
        const sortedItemIds = sortedItems.sort((a, b) => {
          if (sortedItems.length > 6) {
            const aItemNumber = sortedNumberItems.find(item => item.groupId === a.groupId)
            const bItemNumber = sortedNumberItems.find(item => item.groupId === b.groupId)

            if (aItemNumber && bItemNumber) {
              let aContent = ''
              let bContent = ''
              if (aItemNumber.type === 'text') aContent = aItemNumber.content
              if (aItemNumber.type === 'shape') aContent = aItemNumber.text!.content
              if (bItemNumber.type === 'text') bContent = bItemNumber.content
              if (bItemNumber.type === 'shape') bContent = bItemNumber.text!.content
  
              if (aContent && bContent) {
                const aIndex = parseInt(aContent)
                const bIndex = parseInt(bContent)
  
                return aIndex - bIndex
              }
            }
          }

          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const longestText = item.data.items.reduce((longest, current) => current.length > longest.length ? current : longest, '')

        const unusedElIds: string[] = []
        const unusedGroupIds: string[] = []
        const elements = contentsTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'item')) {
            const index = sortedItemIds.findIndex(id => id === el.id)
            const itemTitle = item.data.items[index]
            if (itemTitle) return getNewTextElement({ el, text: itemTitle, maxLine: 1, longestText })

            unusedElIds.push(el.id)
            if (el.groupId) unusedGroupIds.push(el.groupId)
          }
          if (checkTextType(el, 'itemNumber')) {
            const index = sortedNumberItemIds.findIndex(id => id === el.id)
            const offset = item.offset || 0
            return getNewTextElement({ el, text: index + offset + 1 + '', maxLine: 1, digitPadding: true })
          }
          return el
        }).filter(el => !unusedElIds.includes(el.id) && !(el.groupId && unusedGroupIds.includes(el.groupId)))
        slides.push({
          ...contentsTemplate,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'transition') {
        transitionIndex.value = transitionIndex.value + 1
        const elements = transitionTemplate.value.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          if (checkTextType(el, 'content') && item.data.text) {
            return getNewTextElement({ el, text: item.data.text, maxLine: 3 })
          }
          if (checkTextType(el, 'partNumber')) {
            return getNewTextElement({ el, text: transitionIndex.value + '', maxLine: 1, digitPadding: true })
          }
          return el
        })
        slides.push({
          ...transitionTemplate.value,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'content') {
        const _contentTemplates = getUseableTemplates(contentTemplates, item.data.items.length, 'item')
        const contentTemplate = _contentTemplates[Math.floor(Math.random() * _contentTemplates.length)]

        const sortedTitleItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'itemTitle')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedTextItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'item')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedNumberItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'itemNumber')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const itemTitles = []
        const itemTexts = []

        for (const _item of item.data.items) {
          if (_item.title) itemTitles.push(_item.title)
          if (_item.text) itemTexts.push(_item.text)
        }
        const longestTitle = itemTitles.reduce((longest, current) => current.length > longest.length ? current : longest, '')
        const longestText = itemTexts.reduce((longest, current) => current.length > longest.length ? current : longest, '')

        const elements = contentTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (item.data.items.length === 1) {
            const contentItem = item.data.items[0]
            if (checkTextType(el, 'content') && contentItem.text) {
              return getNewTextElement({ el, text: contentItem.text, maxLine: 6 })
            }
          }
          else {
            if (checkTextType(el, 'itemTitle')) {
              const index = sortedTitleItemIds.findIndex(id => id === el.id)
              const contentItem = item.data.items[index]
              if (contentItem && contentItem.title) {
                return getNewTextElement({ el, text: contentItem.title, longestText: longestTitle, maxLine: 1 })
              }
            }
            if (checkTextType(el, 'item')) {
              const index = sortedTextItemIds.findIndex(id => id === el.id)
              const contentItem = item.data.items[index]
              if (contentItem && contentItem.text) {
                return getNewTextElement({ el, text: contentItem.text, longestText, maxLine: 4 })
              }
            }
            if (checkTextType(el, 'itemNumber')) {
              const index = sortedNumberItemIds.findIndex(id => id === el.id)
              const offset = item.offset || 0
              return getNewTextElement({ el, text: index + offset + 1 + '', maxLine: 1, digitPadding: true })
            }
          }
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          return el
        })
        slides.push({
          ...contentTemplate,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'end') {
        const endTemplate = endTemplates[Math.floor(Math.random() * endTemplates.length)]
        const elements = endTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          return el
        })
        slides.push({
          ...endTemplate,
          id: nanoid(10),
          elements,
        })
      }
    }
    
    // 添加幻灯片到store
    if (isEmptySlide.value) slidesStore.setSlides(slides)
    else addSlidesFromData(slides)
    
    // 在所有幻灯片添加完成后，收集并处理需要AI生成的图片
    console.log('🎨 开始处理AI图片生成队列...')
    
    // 收集所有带有alt属性的图片元素
    collectAndQueueImages()
    
    // 如果有需要生成的图片，启动异步生成流程
    if (imageGenerationQueue.value.length > 0) {
      console.log(`🚀 检测到 ${imageGenerationQueue.value.length} 个图片需要AI生成，开始处理...`)
      // 异步处理图片生成，不阻塞UI
      setTimeout(() => {
        startImageGeneration()
      }, 100)
    } else {
      console.log('📷 没有检测到需要AI生成的图片')
    }
  }

  return {
    presetImgPool,
    AIPPT,
    getMdContent,
    getJSONContent,
    // 图片生成队列相关
    isGeneratingImages,
    imageGenerationProgress,
    totalImageCount,
    processedImageCount,
    imageGenerationQueue,
    addToImageQueue,
    startImageGeneration,
    collectAndQueueImages,
  }
}
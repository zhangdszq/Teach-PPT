import { useSlidesStore, useMainStore } from '@/store'
import { createBlankSlide, createSlideFromAIData } from '@/utils/slideUtils'
import { nanoid } from 'nanoid'
import { processElementsWithFixedViewport, applyFixedViewportSettings } from '@/views/Editor/Canvas/utils/elementScaler'
import api from '@/services'
import useAIImageGeneration from '@/hooks/useAIImageGeneration'
import type { Slide } from '@/types/slides'

// AI PPT生成参数接口
export interface AIPPTGenerateParams {
  content: string
  courseType: string
  grade: string
  style?: string
  model?: string
  lessonId?: number
}

// 创建互动幻灯片的辅助函数
const createInteractiveSlide = (aiData: any) => {
  try {
    const slideId = nanoid(10)
    console.log('🎮 开始创建互动幻灯片，ID:', slideId)
    
    const interactiveSlide: Slide = {
      id: slideId,
      elements: [],
      background: { type: 'solid' as const, color: '#ffffff' },
      iframeSrc: aiData.templateUrl || '/interactive-quiz.html',
      isInteractive: true,
      aiData: {
        ...(aiData.aiData || aiData),
        interactiveData: {
          imageConfig: aiData.imageConfig,
          iframeConfig: aiData.iframeConfig,
          interactionConfig: aiData.interactionConfig
        }
      },
      templateData: aiData.templateData
    }
    
    console.log('📊 互动幻灯片数据结构:', {
      id: interactiveSlide.id,
      hasTemplateData: !!interactiveSlide.templateData,
      hasAiData: !!interactiveSlide.aiData,
      templateUrl: interactiveSlide.iframeSrc
    })
    
    return interactiveSlide
  }
  catch (error) {
    console.error('❌ 创建互动幻灯片失败:', error)
    return null
  }
}

// 默认方式创建幻灯片的辅助函数
const createSlideWithDefaultMethod = (processedAIData: any, matchedTemplate: any, blankSlide: any, aiData: any) => {
  try {
    const finalSlide = createSlideFromAIData(processedAIData, matchedTemplate, blankSlide.id)
    finalSlide.aiData = aiData
    console.log('🎨 内容绘制完成，最终页面ID:', finalSlide.id)
    console.log('🎨 最终幻灯片元素数量:', finalSlide.elements.length)
    return finalSlide
  }
  catch (error) {
    console.error('❌ 默认方式创建幻灯片失败:', error)
    return null
  }
}

// 调用后端模板匹配接口
const matchTemplate = async (aiData: any) => {
  try {
    console.log('🔍 调用模板匹配接口，原始AI数据:', aiData)
    
    const pptSlideDdata = JSON.parse(JSON.stringify(aiData))
    const response = await api.matchTemplate(pptSlideDdata)
    
    const result = await response.json()
    console.log('✅ 模板匹配成功:', result)
    
    if (result.status === 'success' && result.data && result.data.length > 0) {
      const bestMatch = result.data[0]
      return {
        templateId: bestMatch.template.templateId,
        layout: bestMatch.template.layoutType,
        elements: extractElementsFromTemplate(bestMatch.template),
        matchScore: bestMatch.score,
        template: bestMatch.template,
        aiData: aiData
      }
    }
    
    return getDefaultTemplate()
  }
  catch (error) {
    console.error('❌ 模板匹配失败:', error)
    return getDefaultTemplate()
  }
}

// 获取默认模板
const getDefaultTemplate = () => {
  return {
    templateId: 'default',
    layout: 'standard',
    elements: ['title', 'content'],
    matchScore: 0
  }
}

// 从模板中提取元素信息
const extractElementsFromTemplate = (template: any) => {
  const elements = ['title', 'content']
  
  if (template.contentStructure) {
    if (template.contentStructure.hasItemList) elements.push('item')
    if (template.contentStructure.hasImages) elements.push('image')
    if (template.contentStructure.hasInteractiveElements) elements.push('interactive')
  }
  
  return elements
}

// 处理AI数据，将words、sentences、imageDescriptions转换为独立的PPT组件
const processAIDataForDisplay = (aiData: any) => {
  const processedData = { ...aiData }
  
  console.log('🔍 开始处理AI数据:', aiData)
  
  // 从metadata字段中提取数据
  let wordsData = aiData.words
  let sentencesData = aiData.sentences
  let imageDescriptionsData = aiData.imageDescriptions
  
  if (aiData.metadata && typeof aiData.metadata === 'object') {
    wordsData = wordsData || aiData.metadata.words
    sentencesData = sentencesData || aiData.metadata.sentences
    imageDescriptionsData = imageDescriptionsData || aiData.metadata.imageDescriptions
  }
  
  const components = []

  // 处理 subtitle
  if (aiData.subtitle) {
    components.push({
      type: 'subtitle',
      id: 'subtitle_0',
      content: aiData.subtitle,
      category: 'subtitle'
    })
  }
  
  // 处理words数组
  if (wordsData && Array.isArray(wordsData) && wordsData.length > 0) {
    wordsData.forEach((word: any, index: number) => {
      if (typeof word === 'string') {
        components.push({
          type: 'word',
          id: `word_${index}`,
          content: word,
          category: 'words'
        })
      }
      else if (word && (word.word || word.content)) {
        components.push({
          type: 'word',
          id: `word_${index}`,
          word: word.word || word.content,
          pronunciation: word.pronunciation || '',
          meaning: word.meaning || '',
          content: `${word.word || word.content}${word.pronunciation ? ` [${word.pronunciation}]` : ''}${word.meaning ? ` - ${word.meaning}` : ''}`,
          category: 'words'
        })
      }
    })
  }
  
  // 处理sentences数组
  if (sentencesData && Array.isArray(sentencesData) && sentencesData.length > 0) {
    sentencesData.forEach((sentence: any, index: number) => {
      if (typeof sentence === 'string') {
        components.push({
          type: 'sentence',
          id: `sentence_${index}`,
          content: sentence,
          category: 'sentences'
        })
      }
      else if (sentence && (sentence.sentence || sentence.content)) {
        components.push({
          type: 'sentence',
          id: `sentence_${index}`,
          sentence: sentence.sentence || sentence.content,
          translation: sentence.translation || '',
          content: `${sentence.sentence || sentence.content}${sentence.translation ? ` (${sentence.translation})` : ''}`,
          category: 'sentences'
        })
      }
    })
  }
  
  // 处理imageDescriptions数组
  if (imageDescriptionsData && Array.isArray(imageDescriptionsData) && imageDescriptionsData.length > 0) {
    imageDescriptionsData.forEach((desc: any, index: number) => {
      if (typeof desc === 'string') {
        components.push({
          type: 'image',
          id: `image_${index}`,
          content: desc,
          category: 'images'
        })
      }
      else if (desc && (desc.description || desc.content)) {
        components.push({
          type: 'image',
          id: `image_${index}`,
          description: desc.description || desc.content,
          content: desc.description || desc.content,
          category: 'images'
        })
      }
    })
  }
  
  processedData.components = components
  
  console.log('✅ AI数据处理完成，组件数量:', components.length)
  console.log('📋 组件详情:', components)
  
  return processedData
}

// 处理单个幻灯片的函数
const processSlide = async (aiData: any, slidesStore: any, onProgress?: (progress: string) => void) => {
  if (aiData.isInteractive) {
    console.log('🎮 检测到互动模板数据，开始创建互动页面:', aiData)
    const interactiveSlide = createInteractiveSlide(aiData)
    if (interactiveSlide) {
      const currentSlides = slidesStore.slides
      if (currentSlides.length === 0 || (currentSlides.length === 1 && !currentSlides[0].elements.length)) {
        slidesStore.setSlides([interactiveSlide])
      }
      else {
        slidesStore.addSlide(interactiveSlide)
      }
    }
    return
  }
  
  // 创建一页空白PPT
  const blankSlide = createBlankSlide()
  console.log('✅ 创建空白PPT页面，ID:', blankSlide.id)
  
  // 处理AI数据
  const processedAIData = processAIDataForDisplay(aiData)
  
  // 调用后端模板匹配接口
  const matchedTemplate = await matchTemplate(aiData)
  console.log('🎨 模板匹配完成:', matchedTemplate)
  
  // 如果匹配到模板，调用use接口应用模板
  if (matchedTemplate && matchedTemplate.templateId !== 'default') {
    try {
      console.log('🔧 调用use接口应用模板:', matchedTemplate.templateId)
      const useResponse = await api.useTemplate({
        templateId: matchedTemplate.templateId,
        aiData: aiData
      })
      
      const useResult = await useResponse.json()
      
      if (!useResponse.ok) {
        throw new Error(`HTTP ${useResponse.status}: ${useResult.message || '请求失败'}`)
      }
    
      if (useResult.status === 'success' && useResult.data) {
        const templateSlides = useResult.data.slides || []
        const processedSlides = []
        
        const templateSize = {
          width: useResult.data.width || useResult.width || 1280,
          height: useResult.data.height || useResult.height || 720
        }
        
        for (const slideData of templateSlides) {
          const slideId = nanoid(10)
          const adaptedElements = processElementsWithFixedViewport(slideData.elements || [], templateSize)
          
          const finalSlide: Slide = {
            id: slideId,
            elements: adaptedElements,
            background: slideData.background || { type: 'solid', color: '#ffffff' },
            aiData: aiData
          }
          
          processedSlides.push(finalSlide)
        }
        
        applyFixedViewportSettings(slidesStore, templateSize)
        
        const currentSlides = slidesStore.slides
        if (currentSlides.length === 0 || (currentSlides.length === 1 && !currentSlides[0].elements.length)) {
          slidesStore.setSlides(processedSlides)
        }
        else {
          processedSlides.forEach(slide => slidesStore.addSlide(slide))
        }
        
        console.log(`✅ 成功添加 ${templateSlides.length} 张文字版幻灯片，当前总数: ${slidesStore.slides.length}`)
        return
      }
      
      console.warn('⚠️ 模板应用失败，使用默认方式创建幻灯片')
    }
    catch (useError) {
      console.error('❌ 调用use接口失败:', useError)
    }
  }
  
  // 使用默认方式创建幻灯片
  console.log('🔄 使用默认模板创建幻灯片')
  const slide = createSlideWithDefaultMethod(processedAIData, matchedTemplate, blankSlide, aiData)
  if (slide) {
    const currentSlides = slidesStore.slides
    if (currentSlides.length === 0 || (currentSlides.length === 1 && !currentSlides[0].elements.length)) {
      slidesStore.setSlides([slide])
    }
    else {
      slidesStore.addSlide(slide)
    }
  }
}

/**
 * 生成AI PPT
 * @param params 生成参数
 * @param onProgress 进度回调函数
 * @param onComplete 完成回调函数
 * @param onError 错误回调函数
 */
export const generateAIPPT = async (
  params: AIPPTGenerateParams,
  onProgress?: (progress: string) => void,
  onComplete?: () => void,
  onError?: (error: any) => void
) => {
  const slidesStore = useSlidesStore()
  const mainStore = useMainStore()
  
  try {
    console.log('🤖 开始生成AI PPT:', params)
    onProgress?.('正在连接AI服务...')
    
    const stream = await api.AIPPT({
      content: params.content,
      courseType: params.courseType,
      grade: params.grade,
      style: params.style || 'modern',
      model: params.model || 'gemini-2.0-flash',
      lessonId: params.lessonId ? Number(params.lessonId) : undefined
    })

    const reader: ReadableStreamDefaultReader = stream.body.getReader()
    const decoder = new TextDecoder('utf-8')
    
    let buffer = ''
    
    // 处理缓冲区数据的函数
    const processBufferData = async (data: string) => {
      try {
        const cleanData = data.replace(/```json/g, '').replace(/```/g, '').trim()
        
        if (!cleanData) return
        
        console.log('🎯 处理缓冲区数据:', cleanData.substring(0, 200) + '...')
        onProgress?.('正在解析AI生成的内容...')
        
        const pages = cleanData.split('---PAGE_SEPARATOR---').filter(page => page.trim())
        
        for (const pageData of pages) {
          const trimmedPageData = pageData.trim()
          if (!trimmedPageData) continue
          
          try {
            const aiData = JSON.parse(trimmedPageData)
            
            if (aiData && typeof aiData === 'object') {
              console.log('📄 成功解析AI数据，开始创建PPT页面:', aiData)
              onProgress?.(`正在创建第${slidesStore.slides.length + 1}页...`)
              
              await processSlide(aiData, slidesStore, onProgress)
            }
          }
          catch (pageError) {
            console.log('⚠️ 跳过无法解析的页面:', trimmedPageData.substring(0, 50) + '...')
          }
        }
        
        buffer = ''
      }
      catch (err) {
        console.error('❌ 处理缓冲区数据失败:', err)
      }
    }
    
    const readStream = () => {
      reader.read().then(async ({ done, value }) => {
        if (done) {
          if (buffer.trim()) {
            await processBufferData(buffer)
          }
          
          console.log('🏁 PPT生成流已完成')
          onProgress?.('PPT生成完成，正在处理图片...')
          
          // 延迟处理图片生成
          setTimeout(async () => {
            try {
              console.log('🖼️ 开始处理图片生成...')
              const { processSlideImages, startImageGeneration } = useAIImageGeneration()
              
              // 为所有幻灯片添加图片到生成队列
              for (const slide of slidesStore.slides) {
                await processSlideImages(slide)
              }
              
              // 启动图片生成队列处理
              await startImageGeneration()
              
              console.log('🎊 所有处理完成！')
              onComplete?.()
            }
            catch (error) {
              console.error('❌ 图片处理失败:', error)
              onError?.(error)
            }
          }, 1000)
          
          return
        }
    
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        await processBufferData(buffer)
        readStream()
      })
    }
    
    readStream()
    
  }
  catch (error) {
    console.error('❌ AI PPT生成失败:', error)
    onError?.(error)
  }
}
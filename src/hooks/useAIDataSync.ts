import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store/slides'
import type { PPTElement } from '@/types/slides'

// 简单的防抖函数实现
function debounce<T extends(...args: any[]) => any>(func: T, wait: number): T {
  let timeout: number | null = null
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

/**
 * AI数据同步 Hook
 * 用于监听幻灯片内容变化并自动更新 aiData.metadata 字段中的数据
 */
export function useAIDataSync() {
  const slidesStore = useSlidesStore()
  const { slides, slideIndex } = storeToRefs(slidesStore)
  
  const isEnabled = ref(true)
  
  // 当前幻灯片
  const currentSlide = computed(() => slides.value[slideIndex.value])
  
  // 提取文本内容的工具函数
  const extractTextFromHTML = (html: string): string => {
    if (!html) return ''
    // 移除HTML标签，保留纯文本
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }
  
  // 从元素中提取文本内容
  const extractElementText = (element: PPTElement): string => {
    switch (element.type) {
      case 'text':
        return extractTextFromHTML(element.content || '')
      case 'shape':
        return element.text?.content ? extractTextFromHTML(element.text.content) : ''
      case 'table':
        // 提取表格中的所有文本
        if (element.data && Array.isArray(element.data)) {
          return element.data.map(row => 
            row.map(cell => cell.text || '').join(' ')
          ).join(' ')
        }
        return ''
      default:
        return ''
    }
  }
  
  // 分析当前元素内容并更新对应的 metadata 数组以及 title、subtitle
  const analyzeElementsForContent = (elements: PPTElement[]) => {
    const words: string[] = []
    const sentences: string[] = []
    const questions: string[] = []
    const imageDescriptions: string[] = []
    let title = ''
    let subtitle = ''
    
    // 检查元素是否有模板类型标记
    const getElementTextType = (element: PPTElement): string | null => {
      if (element.type === 'text' && element.textType) {
        return element.textType
      }
      if (element.type === 'shape' && element.text && element.text.type) {
        return element.text.type
      }
      return null
    }
    
    // 只处理有模板标记的元素
    for (const element of elements) {
      const textType = getElementTextType(element)
      if (!textType) continue // 跳过没有模板标记的元素
      
      const text = extractElementText(element).trim()
      if (!text) continue
      
      // 根据模板标记类型分类到对应位置
      switch (textType) {
        case 'title':
          title = text
          break
        case 'subtitle':
          subtitle = text
          break
        case 'vocabulary':
          words.push(text)
          break
        case 'sentence':
          sentences.push(text)
          break
        case 'question':
          questions.push(text)
          break
        case 'content':
        case 'item':
        case 'itemTitle':
          // 内容类型根据文本特征进一步分类
          if (text.includes('?') || text.includes('？')) {
            questions.push(text)
          }
          else if (text.length > 50 || text.includes('。') || text.includes('.')) {
            sentences.push(text)
          }
          else {
            words.push(text)
          }
          break
        default:
          // 其他类型的文本内容
          if (text.includes('?') || text.includes('？')) {
            questions.push(text)
          }
          else if (text.length > 50 || text.includes('。') || text.includes('.')) {
            sentences.push(text)
          }
          else {
            words.push(text)
          }
          break
      }
    }
    
    // 处理图片元素（只处理有模板标记的图片）
    for (const element of elements) {
      if (element.type === 'image' && element.imageType) {
        // 只有标记了 imageType 的图片才处理
        if (element.alt) {
          imageDescriptions.push(element.alt)
        }
        else {
        // 如果没有 alt 描述，使用图片类型作为描述
          imageDescriptions.push(`${element.imageType} 图片`)
        }
      }
    }
    
    return {
      title,
      subtitle,
      metadata: {
        words,
        sentences,
        questions,
        imageDescriptions,
        wordCount: words.length,
        sentenceCount: sentences.length,
        questionCount: questions.length,
        imageCount: imageDescriptions.length
      }
    }
  }
  
  // 更新 aiData 的防抖函数
  const updateAIDataMetadata = debounce((slideId: string, elements: PPTElement[]) => {
    if (!isEnabled.value) return
    
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide || !slide.aiData) return
    
    console.log('🔄 同步更新 aiData，幻灯片ID:', slideId)
    
    // 分析当前元素内容
    const analyzed = analyzeElementsForContent(elements)
    
    // 更新 aiData，包括 title、subtitle 和 metadata 字段
    const updatedAIData = {
      ...slide.aiData,
      title: analyzed.title || slide.aiData.title,
      subtitle: analyzed.subtitle || slide.aiData.subtitle,
      metadata: {
        ...slide.aiData.metadata,
        ...analyzed.metadata,
        lastModified: new Date().toISOString(),
        syncVersion: (slide.aiData.metadata?.syncVersion || 0) + 1
      }
    }
    
    // 更新幻灯片的 aiData
    slidesStore.updateSlide({ aiData: updatedAIData }, slideId)
    
    console.log('✅ aiData 同步完成:', {
      slideId,
      title: analyzed.title,
      subtitle: analyzed.subtitle,
      wordsCount: analyzed.metadata.words.length,
      sentencesCount: analyzed.metadata.sentences.length,
      questionsCount: analyzed.metadata.questions.length,
      imageDescriptionsCount: analyzed.metadata.imageDescriptions.length
    })
  }, 1000) // 1秒防抖
  
  // 监听当前幻灯片元素变化（只在同一张幻灯片内容变化时触发）
  const lastSlideId = ref<string | null>(null)
  
  watch(
    [
      () => slideIndex.value, 
      () => currentSlide.value?.elements
    ],
    ([newSlideIndex, newElements], [oldSlideIndex, oldElements]) => {
      const currentSlideId = currentSlide.value?.id
      
      // 如果切换了幻灯片，更新记录但不触发同步
      if (newSlideIndex !== oldSlideIndex) {
        lastSlideId.value = currentSlideId || null
        console.log('🔄 切换到幻灯片:', currentSlideId)
        return
      }
      
      // 只有在同一张幻灯片内容发生变化时才触发同步
      if (!currentSlide.value || !currentSlide.value.aiData) return
      
      // 确保 lastSlideId 已初始化
      if (lastSlideId.value === null) {
        lastSlideId.value = currentSlideId || null
      }
      
      // 检查是否有实质性变化
      if (oldElements && JSON.stringify(newElements) === JSON.stringify(oldElements)) {
        return
      }
      
      console.log('📝 检测到幻灯片内容变化，准备同步 aiData')
      updateAIDataMetadata(currentSlide.value.id, newElements || [])
    },
    { deep: true }
  )
  
  // 启用/禁用同步
  const enableSync = () => {
    isEnabled.value = true
    console.log('✅ AI数据同步已启用')
  }
  
  const disableSync = () => {
    isEnabled.value = false
    console.log('⏸️ AI数据同步已禁用')
  }
  
  // 手动触发同步
  const manualSync = (slideId?: string) => {
    const targetSlide = slideId 
      ? slides.value.find(s => s.id === slideId)
      : currentSlide.value
      
    if (!targetSlide || !targetSlide.aiData) {
      console.warn('⚠️ 无法同步：幻灯片不存在或没有 aiData')
      return
    }
    
    console.log('🔄 手动触发 aiData 同步')
    updateAIDataMetadata(targetSlide.id, targetSlide.elements)
  }
  
  return {
    isEnabled,
    enableSync,
    disableSync,
    manualSync
  }
}

export default useAIDataSync
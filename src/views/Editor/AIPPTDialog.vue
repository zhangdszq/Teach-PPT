<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AI英语教学PPT</span>
      <span class="subtite" v-if="step === 'template'">从下方挑选适合的英语教学模板，开始生成课件</span>
      <span class="subtite" v-else-if="step === 'outline'">确认下方英语课程内容（点击编辑内容，右键添加/删除教学环节），开始选择模板</span>
      <span class="subtite" v-else>在下方输入您的英语教学主题，如字母学习、单词教学、语法练习、口语训练等</span>
    </div>
    
    <template v-if="step === 'setup'">
      <Input class="input" 
        ref="inputRef"
        v-model:value="keyword" 
        :maxlength="50" 
        placeholder="请输入英语教学主题，如：字母A的认知与发音练习" 
        @enter="createOutline()"
      >
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <div class="submit" :class="{ 'disabled': isSubmitDisabled }" type="primary" @click="createOutline()"><IconSend class="icon" /> 生成课程内容</div>
        </template>
      </Input>
      <div class="recommends">
        <div class="recommend" 
             v-for="(item, index) in courseTypeOptions" 
             :key="index" 
             :class="{ active: courseType === item }"
             @click="setKeyword(item)">
          {{ item }}
        </div>
      </div>
      <div class="configs">
        <div class="config-item">
          <div class="label">年级：</div>
          <Select 
            style="width: 80px;"
            v-model:value="grade"
            :options="[
              { label: '1年级', value: '1年级' },
              { label: '2年级', value: '2年级' },
              { label: '3年级', value: '3年级' },
              { label: '4年级', value: '4年级' },
              { label: '5年级', value: '5年级' },
              { label: '6年级', value: '6年级' },
              { label: '初一', value: '初一' },
              { label: '初二', value: '初二' },
              { label: '初三', value: '初三' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">风格：</div>
          <Select 
            style="width: 80px;"
            v-model:value="style"
            :options="[
              { label: '儿童友好', value: '儿童友好' },
              { label: '互动游戏', value: '互动游戏' },
              { label: '卡通可爱', value: '卡通可爱' },
              { label: '教育专业', value: '教育专业' },
              { label: '启蒙引导', value: '启蒙引导' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">模型：</div>
          <Select 
            style="width: 190px;"
            v-model:value="model"
            :options="[
              { label: 'GLM-4-Flash', value: 'GLM-4-Flash' },
              { label: 'GLM-4-FlashX', value: 'GLM-4-FlashX' },
              { label: 'Douao-1.5-lite-32k', value: 'ark-doubao-1.5-lite-32k' },
              { label: 'Doubao-seed-1.6-flash', value: 'ark-doubao-seed-1.6-flash' },
              { label: 'DeepSeek-v3（限）', value: 'openrouter-deepseek-v3' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">配图：</div>
          <Select 
            style="width: 100px;"
            v-model:value="img"
            :options="[
              { label: '无配图', value: '' },
              { label: '教学图片', value: 'test' },
              { label: 'AI搜图', value: 'ai-search', disabled: true },
              { label: 'AI生图', value: 'ai-create', disabled: true },
            ]"
          />
        </div>
      </div>
    </template>
    <div class="preview" v-if="step === 'outline'">
      <pre ref="outlineRef" v-if="outlineCreating">{{ outline }}</pre>
       <div class="outline-view" v-else>
         <OutlineEditor v-model:value="outline" />
       </div>
      <div class="btns" v-if="!outlineCreating">
        <Button class="btn" type="primary" @click="openStyleSelect">选择风格</Button>
        <Button class="btn" @click="outline = ''; step = 'setup'">重新设计课程</Button>
      </div>
    </div>

    <FullscreenSpin :loading="loading" tip="正在生成英语教学课件，请耐心等待 ..." />
    
    <!-- 风格选择对话框 -->
    <StyleSelectDialog 
      :visible="styleSelectVisible"
      @close="closeStyleSelect"
      @select="handleStyleSelect"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { courseTypeOptions as courseOptionsData } from '@/configs/course'
import api from '@/services'
import useAIPPT from '@/hooks/useAIPPT'
import type { AIPPTSlide } from '@/types/AIPPT'
import type { Slide, SlideTheme } from '@/types/slides'
import message from '@/utils/message'
import { useMainStore, useSlidesStore } from '@/store'
import { createBlankSlide, createSlideFromAIData } from '@/utils/slideUtils'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import StyleSelectDialog from './StyleSelectDialog.vue'

const mainStore = useMainStore()
const slideStore = useSlidesStore()
const { templates } = storeToRefs(slideStore)
const { AIPPT, presetImgPool, getMdContent } = useAIPPT()

const grade = ref('1年级')
const style = ref('儿童友好')
const img = ref('')
const keyword = ref('')
const courseType = ref('')
const outline = ref('')
const selectedTemplate = ref('template_1')
const loading = ref(false)
const outlineCreating = ref(false)
const outlineRef = ref<HTMLElement>()
const inputRef = ref<InstanceType<typeof Input>>()
const step = ref<'setup' | 'outline' | 'template'>('setup')
const model = ref('GLM-4-Flash')
const styleSelectVisible = ref(false)

const isSubmitDisabled = computed(() => {
  return !keyword.value.trim() || !courseType.value || !grade.value
})

const courseTypeOptions = ref(courseOptionsData)

onMounted(() => {
  setTimeout(() => {
    inputRef.value!.focus()
  }, 500)
})

const setKeyword = (value: string) => {
  courseType.value = value
  inputRef.value!.focus()
}

const openStyleSelect = () => {
  styleSelectVisible.value = true
}

const closeStyleSelect = () => {
  styleSelectVisible.value = false
}

const handleStyleSelect = (selectedStyle: any) => {
  style.value = selectedStyle.name
  styleSelectVisible.value = false
  // 直接开始生成PPT
  createPPT()
}

const createOutline = async () => {
  if (isSubmitDisabled.value) {
    if (!courseType.value) return message.error('请选择课程类型')
    if (!grade.value) return message.error('请选择年级')
    if (!keyword.value.trim()) return message.error('请输入英语教学主题')
    return
  }

  loading.value = true
  outlineCreating.value = true
  
  const stream = await api.AIPPT_Outline({
    content: keyword.value,
    courseType: courseType.value,
    grade: grade.value,
    model: model.value,
  })

  loading.value = false
  step.value = 'outline'

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  // 使用真实的AI流式响应
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        outline.value = getMdContent(outline.value)
        outline.value = outline.value.replace(/<!--[\s\S]*?-->/g, '').replace(/<think>[\s\S]*?<\/think>/g, '')
        outlineCreating.value = false
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      outline.value += chunk

      if (outlineRef.value) {
        outlineRef.value.scrollTop = outlineRef.value.scrollHeight + 20
      }

      readStream()
    })
  }
  readStream()
}

// 默认方式创建幻灯片的辅助函数
const createSlideWithDefaultMethod = (processedAIData: any, matchedTemplate: any, blankSlide: any, aiData: any) => {
  try {
    // 使用工具函数在空白PPT上绘制内容
    const finalSlide = createSlideFromAIData(processedAIData, matchedTemplate, blankSlide.id)
    
    // 保存AI数据到幻灯片中
    finalSlide.aiData = aiData
    console.log('🎨 内容绘制完成，最终页面ID:', finalSlide.id)
    console.log('🎨 最终幻灯片元素数量:', finalSlide.elements.length)
      
    // 添加到幻灯片集合
    const currentSlides = slideStore.slides
    if (currentSlides.length === 0 || (currentSlides.length === 1 && !currentSlides[0].elements.length)) {
      // 如果当前是空幻灯片，直接替换
      slideStore.setSlides([finalSlide])
    } else {
      // 如果已有幻灯片，则添加到现有幻灯片后面
      slideStore.addSlide(finalSlide)
    }
    
    console.log(`✅ 成功添加1张幻灯片，当前总数: ${slideStore.slides.length}`)
  } catch (error) {
    console.error('❌ 默认方式创建幻灯片失败:', error)
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
    
    // 如果匹配成功且有结果，返回最佳匹配的模板
    if (result.status === 'success' && result.data && result.data.length > 0) {
      const bestMatch = result.data[0]
      return {
        templateId: bestMatch.template.templateId,
        layout: bestMatch.template.layoutType,
        elements: extractElementsFromTemplate(bestMatch.template),
        matchScore: bestMatch.score,
        template: bestMatch.template,
        aiData: aiData // 保留原始AI数据
      }
    }
    
    // 返回默认模板
    return getDefaultTemplate()
  } catch (error) {
    console.error('❌ 模板匹配失败:', error)
    return getDefaultTemplate()
  }
}

const createPPT = async () => {
  loading.value = true

  const stream = await api.AIPPT({
    content: outline.value,
    courseType: courseType.value,
    grade: grade.value,
    style: style.value,
    model: model.value,
  })

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  let buffer = '' // 用于累积不完整的数据
  
  // 处理缓冲区数据的函数
  const processBufferData = async (data: string) => {
    try {
      // 清理数据，移除markdown代码块标记
      const cleanData = data.replace(/```json/g, '').replace(/```/g, '').trim()
      
      if (!cleanData) return
      
      console.log('🎯 处理缓冲区数据:', cleanData.substring(0, 200) + '...')
      
      // 按 PAGE_SEPARATOR 分割数据，每个部分是一个完整的JSON对象
      const pages = cleanData.split('---PAGE_SEPARATOR---').filter(page => page.trim())
      
      for (const pageData of pages) {
        const trimmedPageData = pageData.trim()
        if (!trimmedPageData) continue
        
        try {
          // 尝试解析每个页面数据作为JSON
          const aiData = JSON.parse(trimmedPageData)
          
          if (aiData && typeof aiData === 'object') {
            console.log('📄 成功解析AI数据，开始创建PPT页面:', aiData)
            
            // 创建一页空白PPT
            const blankSlide = createBlankSlide()
            console.log('✅ 创建空白PPT页面，ID:', blankSlide.id)
            
            // 处理AI数据，使用words、sentences、imageDescriptions替代content
            const processedAIData = processAIDataForDisplay(aiData)
            console.log('🔄 数据处理完成，组件数量:', processedAIData.components?.length || 0)
            console.log('🔍 处理后的组件详情:', processedAIData.components)
            
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
              console.log('✅ 模板应用响应:', useResult)
              
              // 检查响应状态
              if (!useResponse.ok) {
                throw new Error(`HTTP ${useResponse.status}: ${useResult.message || '请求失败'}`)
              }
              
              if (useResult.status === 'success' && useResult.data) {
                  // 使用后端返回的完整幻灯片数据
                  const templateSlides = useResult.data.slides || []
                  const processedSlides = []
                  
                  // 提取模板尺寸信息，优先从根级别获取
                  const templateSize = {
                    width: useResult.data.width || useResult.width || 1280,
                    height: useResult.data.height || useResult.height || 720
                  }
                  
                  console.log('🔍 从use接口获取的模板尺寸:', templateSize)
                  
                  // 第一步：先创建所有文字版幻灯片并应用尺寸适配
                  for (const slideData of templateSlides) {
                    // 为每个幻灯片创建新的ID
                    const slideId = slideData.id || `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    
                    // 应用固定视口适配处理元素
                    const adaptedElements = processElementsWithFixedViewport(slideData.elements || [], templateSize)
                    
                    // 构建完整的幻灯片对象
                    const finalSlide = {
                      id: slideId,
                      elements: adaptedElements,
                      background: slideData.background || { type: 'solid', color: '#ffffff' },
                      aiData: aiData, // 保存原始AI数据
                      templateInfo: useResult.data.templateInfo
                    }
                    
                    console.log('📝 创建适配后的幻灯片:', finalSlide.id, '元素数量:', finalSlide.elements.length)
                    processedSlides.push(finalSlide)
                  }
                  
                  // 应用固定视口设置
                  applyFixedViewportSettings(templateSize)
                  
                  // 第二步：将所有文字版幻灯片添加到幻灯片集合
                  const currentSlides = slideStore.slides
                  if (currentSlides.length === 0 || (currentSlides.length === 1 && !currentSlides[0].elements.length)) {
                    // 如果当前是空幻灯片，直接替换
                    slideStore.setSlides(processedSlides)
                  } else {
                    // 如果已有幻灯片，则添加到现有幻灯片后面
                    processedSlides.forEach(slide => slideStore.addSlide(slide))
                  }
                  
                  console.log(`✅ 成功添加 ${templateSlides.length} 张文字版幻灯片，当前总数: ${slideStore.slides.length}`)
                  
                  // 第三步：异步处理AI图片生成，不阻塞PPT显示
                  setTimeout(async () => {
                    console.log('🖼️ 开始逐页处理AI图片生成...')
                    await processAllSlidesAIImages(processedSlides)
                  }, 500) // 延迟500ms开始处理图片，确保PPT已经显示
                } else {
                  console.warn('⚠️ 模板应用失败，使用默认方式创建幻灯片')
                  // 回退到原来的方式
                  createSlideWithDefaultMethod(processedAIData, matchedTemplate, blankSlide, aiData)
                }
              } catch (useError) {
                console.error('❌ 调用use接口失败:', useError)
                // 回退到原来的方式
                createSlideWithDefaultMethod(processedAIData, matchedTemplate, blankSlide, aiData)
              }
            } else {
              console.log('🔄 使用默认模板创建幻灯片')
              // 使用默认方式创建幻灯片
              createSlideWithDefaultMethod(processedAIData, matchedTemplate, blankSlide, aiData)
            }
          }
        } catch (pageError) {
          // 页面解析失败，可能是不完整的JSON，继续处理下一页
          console.log('⚠️ 跳过无法解析的页面:', trimmedPageData.substring(0, 50) + '...')
        }
      }
      
      // 清空已处理的缓冲区
      buffer = ''
      
    } catch (err) {
      console.error('❌ 处理缓冲区数据失败:', err)
      // 不显示错误消息，因为可能是数据不完整导致的正常情况
    }
  }
  
  const readStream = () => {
    reader.read().then(async ({ done, value }) => {
      if (done) {
        // 处理最后剩余的数据
        if (buffer.trim()) {
          await processBufferData(buffer)
        }
        loading.value = false
        mainStore.setAIPPTDialogState(false)
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      // 尝试从缓冲区中提取完整的JSON对象
      await processBufferData(buffer)

      readStream()
    })
  }
  
  readStream()
}

// 从AI数据中提取布局类型
const getLayoutTypeFromAIData = (aiData: any): string => {
  if (aiData.items && Array.isArray(aiData.items)) {
    if (aiData.items.length > 4) return 'grid'
    if (aiData.items.length > 1) return 'list'
  }
  if (aiData.title && aiData.content) return 'title-content'
  return 'standard'
}

// 从AI数据中提取元素需求
const getElementRequirementsFromAIData = (aiData: any) => {
  const requirements = []
  
  if (aiData.title) {
    requirements.push({ type: 'title', count: 1 })
  }
  
  if (aiData.content) {
    requirements.push({ type: 'content', count: 1 })
  }
  
  if (aiData.items && Array.isArray(aiData.items)) {
    requirements.push({ type: 'item', count: aiData.items.length })
  }
  
  return requirements
}

// 从AI数据中提取标签
const getTagsFromAIData = (aiData: any) => {
  const tags = []
  
  if (courseType.value) {
    tags.push(courseType.value)
  }
  
  if (style.value) {
    tags.push(style.value)
  }
  
  // 根据内容添加标签
  const content = (aiData.title || '') + ' ' + (aiData.content || '')
  if (content.includes('字母')) tags.push('字母教学')
  if (content.includes('单词')) tags.push('单词教学')
  if (content.includes('发音')) tags.push('发音练习')
  if (content.includes('游戏')) tags.push('互动游戏')
  
  return tags
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
  console.log('🔍 检查顶级字段存在性:', {
    hasWords: !!aiData.words,
    hasSentences: !!aiData.sentences,
    hasImageDescriptions: !!aiData.imageDescriptions,
    hasMetadata: !!aiData.metadata,
    hasContent: !!aiData.content
  })
  
  // 从metadata字段中提取数据
  let wordsData = aiData.words
  let sentencesData = aiData.sentences
  let imageDescriptionsData = aiData.imageDescriptions
  
  // 如果顶级没有这些字段，尝试从metadata中获取
  if (aiData.metadata && typeof aiData.metadata === 'object') {
    console.log('🔍 检查metadata字段内容:', aiData.metadata)
    console.log('🔍 metadata字段存在性:', {
      hasWords: !!aiData.metadata.words,
      wordsLength: aiData.metadata.words?.length || 0,
      hasSentences: !!aiData.metadata.sentences,
      sentencesLength: aiData.metadata.sentences?.length || 0,
      hasImageDescriptions: !!aiData.metadata.imageDescriptions,
      imageDescriptionsLength: aiData.metadata.imageDescriptions?.length || 0
    })
    
    wordsData = wordsData || aiData.metadata.words
    sentencesData = sentencesData || aiData.metadata.sentences
    imageDescriptionsData = imageDescriptionsData || aiData.metadata.imageDescriptions
  }
  
  // 创建组件数组，每个item都是独立的组件
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
  
  // 处理words数组，每个单词作为独立组件
  if (wordsData && Array.isArray(wordsData) && wordsData.length > 0) {
    console.log('✅ 处理words数组，数量:', wordsData.length)
    wordsData.forEach((word: any, index: number) => {
      if (typeof word === 'string') {
        components.push({
          type: 'word',
          id: `word_${index}`,
          content: word,
          category: 'words'
        })
      } else if (word && (word.word || word.content)) {
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
  
  // 处理sentences数组，每个句子作为独立组件
  if (sentencesData && Array.isArray(sentencesData) && sentencesData.length > 0) {
    console.log('✅ 处理sentences数组，数量:', sentencesData.length)
    sentencesData.forEach((sentence: any, index: number) => {
      if (typeof sentence === 'string') {
        components.push({
          type: 'sentence',
          id: `sentence_${index}`,
          content: sentence,
          category: 'sentences'
        })
      } else if (sentence && (sentence.sentence || sentence.content)) {
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
  
  // 处理imageDescriptions数组，每个描述作为独立组件
  if (imageDescriptionsData && Array.isArray(imageDescriptionsData) && imageDescriptionsData.length > 0) {
    console.log('✅ 处理imageDescriptions数组，数量:', imageDescriptionsData.length)
    imageDescriptionsData.forEach((desc: any, index: number) => {
      if (typeof desc === 'string') {
        components.push({
          type: 'image',
          id: `image_${index}`,
          content: desc,
          category: 'imageDescriptions'
        })
      } else if (desc && (desc.description || desc.content)) {
        components.push({
          type: 'image',
          id: `image_${index}`,
          description: desc.description || desc.content,
          purpose: desc.purpose || '',
          content: `${desc.description || desc.content}${desc.purpose ? ` (用途：${desc.purpose})` : ''}`,
          category: 'imageDescriptions'
        })
      }
    })
  }
  
  // 如果没有找到这三个字段，尝试从其他可能的字段中提取数据
  if (components.length === 0) {
    console.log('⚠️ 未找到words/sentences/imageDescriptions字段，尝试从其他字段提取数据')
    
    // 检查是否有items字段
    if (aiData.items && Array.isArray(aiData.items)) {
      console.log('🔍 发现items字段，数量:', aiData.items.length)
      aiData.items.forEach((item: any, index: number) => {
        const itemText = typeof item === 'string' ? item : (item.text || item.content || '')
        if (itemText) {
          // 根据内容判断类型
          let type = 'word'
          if (itemText.includes('句子') || itemText.includes('对话') || itemText.length > 20) {
            type = 'sentence'
          } else if (itemText.includes('图片') || itemText.includes('图像') || itemText.includes('描述')) {
            type = 'image'
          }
          
          components.push({
            type,
            id: `item_${index}`,
            content: itemText,
            category: 'items'
          })
        }
      })
    }
    
    // 如果还是没有组件，从content字段创建一个通用组件
    if (components.length === 0 && aiData.content) {
      console.log('🔍 从content字段创建通用组件')
      components.push({
        type: 'word',
        id: 'content_0',
        content: aiData.content,
        category: 'content'
      })
    }
  }
  
  // 将组件数组添加到处理后的数据中
  processedData.components = components
  
  // 如果没有组件但有原始content，保留原始content
  if (components.length === 0 && aiData.content) {
    processedData.content = aiData.content
  } else {
    // 清空原始content，使用组件数据
    processedData.content = ''
  }
  
  console.log('📝 AI数据处理完成:', {
    原始数据字段: Object.keys(aiData),
    组件数量: components.length,
    组件类型分布: components.reduce((acc, comp) => {
      acc[comp.type] = (acc[comp.type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    组件列表: components
  })
  
  return processedData
}

// 批量处理所有幻灯片的AI图片生成
const processAllSlidesAIImages = async (slides: any[]) => {
  try {
    console.log(`🖼️ 开始批量处理 ${slides.length} 张幻灯片的AI图片生成`)
    
    let totalImagesProcessed = 0
    
    // 逐页处理AI图片生成
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      console.log(`📄 处理第 ${i + 1}/${slides.length} 张幻灯片: ${slide.id}`)
      
      // 查找当前幻灯片中需要AI生成图片的元素
      const imageElements = slide.elements.filter((element: any) => 
        element.type === 'image' && element.alt && element.alt.trim() !== '' && element.alt !== 'REMOVE_THIS_ELEMENT'
      )
      
      if (imageElements.length === 0) {
        console.log(`📷 第 ${i + 1} 张幻灯片无需AI生成图片`)
        continue
      }
      
      console.log(`🎯 第 ${i + 1} 张幻灯片找到 ${imageElements.length} 个需要AI生成图片的元素`)
      
      // 为当前幻灯片的每个图片元素生成AI图片
      for (const imageElement of imageElements) {
        try {
          const prompt = imageElement.alt
          console.log(`🎨 为第 ${i + 1} 张幻灯片的图片元素 ${imageElement.id} 生成AI图片，提示词: ${prompt}`)
          
          // 调用AI图片生成接口
          const imageResponse = await api.AI_Image({
            prompt: prompt,
            model: 'jimeng' // 使用即梦模型
          })
          
          if (imageResponse.ok) {
            const imageResult = await imageResponse.json()
            console.log('🖼️ AI图片生成响应:', imageResult)
            
            if (imageResult.status === 'success' && imageResult.data && (imageResult.data.imageUrl || imageResult.data.image_url)) {
              // 更新图片元素的src属性，兼容两种字段名
              const imageUrl = imageResult.data.imageUrl || imageResult.data.image_url
              imageElement.src = imageUrl
              totalImagesProcessed++
              
              console.log(`✅ 成功为第 ${i + 1} 张幻灯片的图片元素 ${imageElement.id} 设置AI生成的图片: ${imageUrl}`)
              
              // 触发幻灯片更新，让用户看到图片替换效果
              slideStore.updateSlide(slide.id, slide)
              
            } else {
              console.warn(`⚠️ 第 ${i + 1} 张幻灯片的图片元素 ${imageElement.id} AI图片生成失败:`, imageResult.message || '未知错误')
            }
          } else {
            console.warn(`⚠️ 第 ${i + 1} 张幻灯片的图片元素 ${imageElement.id} AI图片生成请求失败`)
          }
          
          // 添加延迟避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 2000))
          
        } catch (imageError) {
          console.error(`❌ 为第 ${i + 1} 张幻灯片的图片元素 ${imageElement.id} 生成AI图片时出错:`, imageError)
          // 继续处理下一个图片元素，不中断整个流程
        }
      }
      
      console.log(`🎉 第 ${i + 1} 张幻灯片AI图片处理完成`)
      
      // 每处理完一张幻灯片，稍作延迟
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`🎊 所有幻灯片AI图片生成完成！总共处理了 ${totalImagesProcessed} 张图片`)
    
  } catch (error) {
    console.error('❌ 批量处理AI图片生成时出错:', error)
    // 不抛出错误，避免影响整个PPT生成流程
  }
}

// 使用固定视口模式处理元素适配
const processElementsWithFixedViewport = (elements: any[], slideSize?: { width: number; height: number }) => {
  if (!slideSize) {
    slideSize = { width: 1280, height: 720 }
  }
  
  const ratio = 1000 / slideSize.width
  console.log(`🔧 应用固定视口适配: 原始尺寸 ${slideSize.width}x${slideSize.height}, 缩放比例 ${ratio}`)
  
  if (Math.abs(slideSize.width - 1000) < 1) {
    console.log('模板已经是标准尺寸，跳过缩放处理')
    return elements
  }
  
  return elements.map(element => {
    const scaledElement = { ...element }
    
    scaledElement.left = element.left * ratio
    scaledElement.top = element.top * ratio
    scaledElement.width = element.width * ratio
    
    if (element.type !== 'line' && 'height' in element) {
      scaledElement.height = element.height * ratio
    }
    
    if (element.type === 'text' && element.content) {
      scaledElement.content = scaleHtmlContent(element.content, ratio)
    }
    
    if (element.type === 'shape' && element.text?.content) {
      scaledElement.text = {
        ...element.text,
        content: scaleHtmlContent(element.text.content, ratio)
      }
    }
    
    return scaledElement
  })
}

// 缩放HTML内容中的字体大小
const scaleHtmlContent = (html: string, ratio: number) => {
  return html
    .replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    .replace(/font-size:\s*([\d.]+)px/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
}

// 应用固定视口设置
const applyFixedViewportSettings = (slideSize?: { width: number; height: number }) => {
  if (!slideSize) {
    slideSize = { width: 1280, height: 720 }
  }
  
  slideStore.setViewportSize(1000)
  slideStore.setViewportRatio(slideSize.height / slideSize.width)
  
  console.log(`🔧 设置固定视口: 宽度 1000px, 比例 ${slideSize.height / slideSize.width}`)
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

</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 12px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtite {
    color: #888;
    font-size: 12px;
  }
}
.preview {
  pre {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .outline-view {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.recommends {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;

  .recommend {
    font-size: 12px;
    background-color: #f1f1f1;
    border-radius: $borderRadius;
    padding: 3px 5px;
    margin-right: 5px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      color: $themeColor;
    }

    &.active {
      background-color: $themeColor;
      color: #fff;
    }
  }
}
.configs {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;

  .config-item {
    font-size: 13px;
    display: flex;
    align-items: center;
  }
}
.count {
  font-size: 12px;
  color: #999;
  margin-right: 10px;
}
.submit {
  height: 20px;
  font-size: 12px;
  background-color: $themeColor;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    background-color: $themeHoverColor;
  }

  &.disabled {
    background-color: #ccc;
    cursor: not-allowed;

    &:hover {
      background-color: #ccc;
    }
  }

  .icon {
    font-size: 15px;
    margin-right: 3px;
  }
}
</style>

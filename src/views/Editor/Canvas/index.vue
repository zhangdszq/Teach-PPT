<template>
  <div 
    class="canvas" 
    ref="canvasRef"
    @wheel="$event => handleMousewheelCanvas($event)"
    @mousedown="$event => handleClickBlankArea($event)"
    @dblclick="$event => handleDblClick($event)"
    v-contextmenu="contextmenus"
    v-click-outside="removeEditorAreaFocus"
  >
    <ElementCreateSelection
      v-if="creatingElement"
      @created="data => insertElementFromCreateSelection(data)"
    />
    <ShapeCreateCanvas
      v-if="creatingCustomShape"
      @created="data => insertCustomShape(data)"
    />
    
    <!-- 互动模版 iframe 模式 -->
    <iframe 
      v-if="isInteractiveTemplate"
      ref="iframeRef"
      class="interactive-template-iframe"
      :style="{
        width: viewportStyles.width * canvasScale + 'px',
        height: viewportStyles.height * canvasScale + 'px',
        left: viewportStyles.left + 'px',
        top: viewportStyles.top + 'px',
        position: 'absolute',
        border: 'none',
        borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
      }"
      :src="getIframeUrl()"
      frameborder="0"
      allowfullscreen
    ></iframe>

    <!-- 原始编辑器模式 -->
    <div 
      v-else
      class="viewport-wrapper"
      :style="{
        width: viewportStyles.width * canvasScale + 'px',
        height: viewportStyles.height * canvasScale + 'px',
        left: viewportStyles.left + 'px',
        top: viewportStyles.top + 'px',
      }"
    >
      <div class="operates">
        <AlignmentLine 
          v-for="(line, index) in alignmentLines" 
          :key="index" 
          :type="line.type" 
          :axis="line.axis" 
          :length="line.length"
          :canvasScale="canvasScale"
        />
        <MultiSelectOperate 
          v-if="activeElementIdList.length > 1"
          :elementList="elementList"
          :scaleMultiElement="scaleMultiElement"
        />
        <Operate
          v-for="element in elementList" 
          :key="element.id"
          :elementInfo="element"
          :isSelected="activeElementIdList.includes(element.id)"
          :isActive="handleElementId === element.id"
          :isActiveGroupElement="activeGroupElementId === element.id"
          :isMultiSelect="activeElementIdList.length > 1"
          :rotateElement="rotateElement"
          :scaleElement="scaleElement"
          :openLinkDialog="openLinkDialog"
          :dragLineElement="dragLineElement"
          :moveShapeKeypoint="moveShapeKeypoint"
          v-show="!hiddenElementIdList.includes(element.id)"
        />
        <ViewportBackground />
      </div>

      <div 
        class="viewport" 
        ref="viewportRef"
        :style="{ transform: `scale(${canvasScale})` }"
      >
        <MouseSelection 
          v-if="mouseSelectionVisible"
          :top="mouseSelection.top" 
          :left="mouseSelection.left" 
          :width="mouseSelection.width" 
          :height="mouseSelection.height" 
          :quadrant="mouseSelectionQuadrant"
        />      
        <EditableElement 
          v-for="(element, index) in elementList" 
          :key="element.id"
          :elementInfo="element"
          :elementIndex="index + 1"
          :isMultiSelect="activeElementIdList.length > 1"
          :selectElement="selectElement"
          :openLinkDialog="openLinkDialog"
          :openAIImageDialog="openAIImageDialog"
          v-show="!hiddenElementIdList.includes(element.id)"
        />
      </div>
    </div>

    <div class="drag-mask" v-if="spaceKeyState"></div>

    <Ruler :viewportStyles="viewportStyles" :elementList="elementList" v-if="showRuler" />

    <Modal
      v-model:visible="linkDialogVisible" 
      :width="540"
    >
      <LinkDialog @close="linkDialogVisible = false" />
    </Modal>

    <AIImageDialog 
      :visible="aiImageDialogVisible"
      @close="aiImageDialogVisible = false"
    />

    <SaveTemplateDialog 
      :visible="saveTemplateDialogVisible"
      @close="saveTemplateDialogVisible = false"
    />

    <TemplateSelectDialog 
      :visible="manualTemplateSelectVisible"
      :aiData="slides[slideIndex]?.aiData"
      @close="closeManualTemplateSelect"
      @select="handleManualTemplateSelect"
    />

    <Modal
      v-model:visible="contentDataDialogVisible" 
      :width="800"
      title="查看内容数据"
    >
      <div class="content-data-dialog">
        <div class="data-content">
          <pre>{{ formattedContentData }}</pre>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch, watchEffect } from 'vue'
import { throttle } from 'lodash'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useMainStore, useSlidesStore, useKeyboardStore } from '@/store'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import type { PPTElement, PPTShapeElement } from '@/types/slides'
import type { AlignmentLineProps, CreateCustomShapeData } from '@/types/edit'
import { injectKeySlideScale } from '@/types/injectKey'
import { removeAllRanges } from '@/utils/selection'
import { KEYS } from '@/configs/hotkey'
import emitter, { EmitterEvents } from '@/utils/emitter'

import useViewportSize from './hooks/useViewportSize'
import useMouseSelection from './hooks/useMouseSelection'
import useDropImageOrText from './hooks/useDropImageOrText'
import useRotateElement from './hooks/useRotateElement'
import useScaleElement from './hooks/useScaleElement'
import useSelectAndMoveElement from './hooks/useSelectElement'
import useDragElement from './hooks/useDragElement'
import useDragLineElement from './hooks/useDragLineElement'
import useMoveShapeKeypoint from './hooks/useMoveShapeKeypoint'
import useInsertFromCreateSelection from './hooks/useInsertFromCreateSelection'

import useDeleteElement from '@/hooks/useDeleteElement'
import useCopyAndPasteElement from '@/hooks/useCopyAndPasteElement'
import useSelectElement from '@/hooks/useSelectElement'
import useScaleCanvas from '@/hooks/useScaleCanvas'
import useScreening from '@/hooks/useScreening'
import useSlideHandler from '@/hooks/useSlideHandler'
import useCreateElement from '@/hooks/useCreateElement'
import useTemplateAIImage from '@/hooks/useTemplateAIImage'
import useAIDataSync from '@/hooks/useAIDataSync'
import api from '@/services'
import message from '@/utils/message'

import EditableElement from './EditableElement.vue'
import MouseSelection from './MouseSelection.vue'
import ViewportBackground from './ViewportBackground.vue'
import AlignmentLine from './AlignmentLine.vue'
import Ruler from './Ruler.vue'
import ElementCreateSelection from './ElementCreateSelection.vue'
import ShapeCreateCanvas from './ShapeCreateCanvas.vue'
import MultiSelectOperate from './Operate/MultiSelectOperate.vue'
import Operate from './Operate/index.vue'
import LinkDialog from './LinkDialog.vue'
import AIImageDialog from '../AIImageDialog.vue'
import SaveTemplateDialog from '../SaveTemplateDialog.vue'
import TemplateSelectDialog from '../TemplateSelectDialog.vue'
import Modal from '@/components/Modal.vue'

const mainStore = useMainStore()
const {
  activeElementIdList,
  activeGroupElementId,
  handleElementId,
  hiddenElementIdList,
  editorAreaFocus,
  gridLineSize,
  showRuler,
  creatingElement,
  creatingCustomShape,
  canvasScale,
  textFormatPainter,
  showMarkupPanel,
} = storeToRefs(mainStore)
const slidesStore = useSlidesStore()
const { currentSlide, slideIndex, slides } = storeToRefs(slidesStore)
const { ctrlKeyState, spaceKeyState } = storeToRefs(useKeyboardStore())

const viewportRef = ref<HTMLElement>()
const alignmentLines = ref<AlignmentLineProps[]>([])

const linkDialogVisible = ref(false)
const openLinkDialog = () => linkDialogVisible.value = true

const aiImageDialogVisible = ref(false)
const openAIImageDialog = () => {
  // 确保选中的是图片元素
  if (handleElementId.value) {
    const element = elementList.value.find(el => el.id === handleElementId.value)
    if (element && element.type === 'image') {
      aiImageDialogVisible.value = true
    }
  }
}

const saveTemplateDialogVisible = ref(false)
const openSaveTemplateDialog = () => {
  if (!currentSlide.value) {
    message.error('当前页面为空，无法保存为模板')
    return
  }
  saveTemplateDialogVisible.value = true
}

const openMarkupPanel = () => {
  mainStore.setMarkupPanelState(true)
}

// iframe 相关功能
const iframeRef = ref<HTMLIFrameElement>()
const isInteractiveTemplate = ref(false)

// 记录每个幻灯片的互动模式状态
const slideInteractiveStates = ref<Map<string, boolean>>(new Map())

// 监听幻灯片切换，管理互动模式状态
watch(() => slideIndex.value, (newIndex, oldIndex) => {
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
}, { immediate: true })

// 获取 iframe URL
const getIframeUrl = () => {
  // return 'public/interactive-quiz.html'
  // return 'public/drag-word-quiz.html'
  return 'public/word-shooter-game.html'
}

// iframe 消息处理
const sendMessageToIframe = (message: any) => {
  if (iframeRef.value?.contentWindow) {
    try {
      // 深度克隆对象以避免 DataCloneError
      const clonedMessage = JSON.parse(JSON.stringify(message))
      iframeRef.value.contentWindow.postMessage(clonedMessage, '*')
    }
    catch (error) {
      console.error('发送消息到iframe失败:', error)
    }
  }
}

const handleIframeMessage = (event: MessageEvent) => {
  console.log('收到来自 iframe 的消息:', event.data)
  
  if (event.data.type === 'iframeReady') {
    // iframe准备就绪，发送初始化数据
    const hardcodedData = {
      content: {
        config: {
          audioEnable: false
        },
        msg: {
          autoPlay: true,
          eventType: '200',
          page: 2,
          questions: [
            {
              options: [
                {
                  option: 'A',
                  text: 'book'
                },
                {
                  option: 'B',
                  text: 'pencil',
                  correct: true
                },
                {
                  option: 'C',
                  text: 'ruler'
                }
              ],
              question: 'which one is the pencil?',
              imgUrl: 'https://s.vipkidstatic.com/fe-static/temp/test_pencil.jpeg',
              questionCommand: 'look and choose',
              questionId: 'question-1',
              questionType: 'CHOICE',
              subType: 'C02'
            }
          ]
        }
      },
      from: 'b7ec2a79-dd56-40aa-b5d6-11027d7e3e19',
      msgType: 'ppt',
      time: '18:48:01'
    }
    
    sendMessageToIframe({
      type: 'initData',
      data: hardcodedData
    })
  }
  else if (event.data.type === 'requestAIData') {
    // iframe请求AI数据
    const currentSlide = slides.value[slideIndex.value]
    sendMessageToIframe({
      type: 'aiDataResponse',
      data: currentSlide?.aiData || null
    })
  }
  else if (event.data.type === 'testMessage') {
    // 处理测试消息
    console.log('收到iframe测试消息:', event.data.data)
    message.info(`iframe消息: ${event.data.data}`)
  }
}

onMounted(() => window.addEventListener('message', handleIframeMessage))
onUnmounted(() => window.removeEventListener('message', handleIframeMessage))

// 查看内容数据对话框相关
const contentDataDialogVisible = ref(false)
const currentSlideAIData = ref(null)

const formattedContentData = computed(() => {
  if (!currentSlideAIData.value) return '暂无数据'
  return JSON.stringify(currentSlideAIData.value, null, 2)
})

const openContentDataDialog = () => {
  const currentSlide = slides.value[slideIndex.value]
  if (!currentSlide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  if (!currentSlide.aiData) {
    message.warning('当前幻灯片没有AI生成的数据')
    return
  }
  
  currentSlideAIData.value = currentSlide.aiData
  contentDataDialogVisible.value = true
}

// 自动匹配模板功能
const matchTemplate = async () => {
  const currentSlide = slides.value[slideIndex.value]
  if (!currentSlide) {
    message.warning('当前没有选中的幻灯片')
    return
  }

  try {
    message.info('正在匹配模板...')
    
    // 调用后端模板匹配接口
    const response = await api.matchTemplate( currentSlide.aiData)
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      const matchResults = data.data
      if (matchResults.length > 0) {
        message.success(`找到 ${matchResults.length} 个匹配的模板`)
        console.log('模板匹配结果:', matchResults)
        // 这里可以添加显示匹配结果的逻辑，比如打开一个对话框展示匹配的模板
      }
      else {
        message.warning('未找到匹配的模板')
      }
    }
    else {
      message.error(data.message || '模板匹配失败')
    }
  }
  catch (error) {
    console.error('模板匹配错误:', error)
    message.error('模板匹配失败，请稍后重试')
  }
}

// 从元素列表中提取元素需求
const extractElementRequirements = (elements: PPTElement[]) => {
  const elementCounts: { [key: string]: number } = {}
  
  elements.forEach(element => {
    const type = element.type
    elementCounts[type] = (elementCounts[type] || 0) + 1
  })
  
  return Object.entries(elementCounts).map(([type, count]) => ({
    type,
    count
  }))
}

const closeContentDataDialog = () => {
  contentDataDialogVisible.value = false
  currentSlideAIData.value = null
}

// 重新生成AI数据
const regenerateAIData = async () => {
  const currentSlide = slides.value[slideIndex.value]
  if (!currentSlide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  if (!currentSlide.aiData || !currentSlide.aiData.content) {
    message.warning('当前幻灯片没有AI生成的内容数据')
    return
  }

  try {
    message.info('正在重新生成AI数据...')
    
    // 调用后端重新生成接口
    const response = await api.regenerateAIData({
      content: currentSlide.aiData.content,
      pageNumber: slideIndex.value + 1, // 页码从1开始
      totalPages: slides.value.length
    })
    
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      // 使用updateSlide方法更新当前幻灯片的aiData
      slidesStore.updateSlide({
        aiData: data.data
      })
      
      // 显示新的AI数据在对话框中
      currentSlideAIData.value = data.data
      contentDataDialogVisible.value = true
      
      message.success('AI数据重新生成成功')
    }
    else {
      message.error(data.message || 'AI数据重新生成失败')
    }
  }
  catch (error) {
    console.error('重新生成AI数据错误:', error)
    message.error('AI数据重新生成失败，请稍后重试')
  }
}

// AI 生成教学步骤
const generateTeachingSteps = async () => {
  const currentSlide = slides.value[slideIndex.value]
  if (!currentSlide) {
    message.warning('当前没有选中的幻灯片')
    return
  }

  try {
    message.info('正在截图并生成教学步骤...')
    
    // 等待元素渲染完成
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 使用与ExportServer相同的策略查找目标元素
    const selectors = [
      '.viewport-wrapper',
      '.viewport',
      '.slide-content',
      '.editor-content',
      '[class*="canvas"]',
      '[class*="viewport"]',
      '[class*="slide"]'
    ]

    let targetElement: HTMLElement | null = null

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement
      if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
        targetElement = element
        console.log(`✅ 找到可用元素: ${selector}`, {
          width: element.offsetWidth,
          height: element.offsetHeight,
          className: element.className
        })
        break
      }
    }

    if (!targetElement) {
      throw new Error('未找到任何可用的页面元素进行截图')
    }
    
    // 使用工具类截图当前PPT
    const { captureElement } = await import('@/utils/image')
    const imageBase64 = await captureElement(targetElement, {
      backgroundColor: '#ffffff',
      scale: 1,
      maxWidth: 800,
      maxHeight: 600,
      quality: 0.8
    })
    
    if (!imageBase64) {
      throw new Error('截图失败')
    }
    
    // 调用后端生成教学步骤接口
    const response = await fetch('/api/ai/teaching-steps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: imageBase64,
        aiData: currentSlide.aiData
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    // 处理非流式响应
    const result = await response.json()
    
    if (result.status === 'success' && result.data) {
      const teachingStepsContent = result.data
      
      // 将生成的教学步骤写入备注栏
      if (teachingStepsContent.trim()) {
        slidesStore.updateSlide({
          remark: teachingStepsContent
        }, currentSlide.id)
        message.success('教学步骤已生成并写入备注栏')
      }
      else {
        message.warning('未生成有效的教学步骤内容')
      }
    }
    else {
      throw new Error(result.message || '教学步骤生成失败')
    }
    
  }
  catch (error) {
    console.error('生成教学步骤错误:', error)
    message.error('生成教学步骤失败，请稍后重试')
  }
}

// 手动选择模版对话框相关
const manualTemplateSelectVisible = ref(false)

const openManualTemplateSelect = () => {
  const currentSlide = slides.value[slideIndex.value]
  if (!currentSlide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  if (!currentSlide.aiData) {
    message.warning('当前幻灯片没有AI生成的数据，无法进行模版匹配')
    return
  }
  
  manualTemplateSelectVisible.value = true
}

const closeManualTemplateSelect = () => {
  manualTemplateSelectVisible.value = false
}

const handleManualTemplateSelect = async (template: any) => {
  try {
    message.info('正在应用选择的模版...')
    
    const currentSlide = slides.value[slideIndex.value]
    if (!currentSlide || !currentSlide.aiData) {
      message.error('当前幻灯片数据异常')
      return
    }

    // 调用后端 /use 接口，传入 templateId 和 aiData
    const response = await api.useTemplate({
      templateId: template.id,
      aiData: currentSlide.aiData
    })
    
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      // 后端返回的数据结构：data.slides[0] 包含处理后的幻灯片数据
      const responseData = data.data
      
      console.log('后端返回的完整数据:', responseData)
      
      // 检查是否有slides数据
      if (responseData.slides && responseData.slides.length > 0) {
        const newSlideData = responseData.slides[0] // 取第一个幻灯片数据
        
        console.log('提取的幻灯片数据:', newSlideData)
        
        // 更新当前幻灯片的内容
        if (newSlideData.elements && Array.isArray(newSlideData.elements)) {
          // 构建尺寸信息对象，从根级别的responseData中获取width和height
          const slideSize = {
            width: responseData.width || 1280,
            height: responseData.height || 720
          }
          
          console.log('从后端获取的模板尺寸:', slideSize)
          
          // 使用 fixedViewport 模式处理元素适配
          const processedElements = processElementsWithFixedViewport(newSlideData.elements, slideSize)
          
          // 更新幻灯片元素和背景
          slidesStore.updateSlide({
            elements: processedElements,
            background: newSlideData.background || currentSlide.background,
            // 保持原有的aiData
            aiData: currentSlide.aiData
          })
          
          // 设置适配的视口大小
          applyFixedViewportSettings(slideSize)
          
          message.success(`成功应用模版：${template.name}`)
          console.log('模版应用成功，已更新幻灯片内容并适配画布')
          
          // 检查是否有需要生成AI图片的元素
          nextTick(() => {
            if (hasTemplateImages()) {
              const imageCount = getTemplateImageCount()
              message.info(`检测到 ${imageCount} 个图片需要AI生成，正在处理...`)
              // 自动开始AI图片生成，明确传递当前幻灯片索引
              processTemplateImages(slideIndex.value)
            }
          })
        }
        else {
          console.error('幻灯片元素数据异常:', newSlideData)
          message.warning('模版数据格式异常：缺少有效的元素数据')
        }
      }
      else {
        console.error('后端返回数据格式异常:', responseData)
        message.warning('模版数据格式异常：缺少幻灯片数据')
      }
      
    }
    else {
      message.error(data.message || '模版应用失败，请重试')
    }
    
    manualTemplateSelectVisible.value = false
  }
  catch (error) {
    console.error('手动选择模版错误:', error)
    message.error('模版应用失败，请稍后重试')
  }
}

// 使用固定视口模式处理元素适配
const processElementsWithFixedViewport = (elements: PPTElement[], slideSize?: { width: number; height: number }) => {
  if (!slideSize) {
    // 如果没有尺寸信息，假设是 1280x720
    slideSize = { width: 1280, height: 720 }
  }
  
  // 计算缩放比例，固定视口宽度为 1000px
  const ratio = 1000 / slideSize.width
  
  console.log(`应用固定视口适配: 原始尺寸 ${slideSize.width}x${slideSize.height}, 缩放比例 ${ratio}`)
  
  // 如果已经是标准尺寸（1000px宽度），不需要缩放
  if (Math.abs(slideSize.width - 1000) < 1) {
    console.log('模板已经是标准尺寸，跳过缩放处理')
    // 仍然需要为每个元素生成新的 id
    return elements.map(element => ({
      ...element,
      id: nanoid(10)
    }))
  }
  
  // 对所有元素应用缩放
  return elements.map(element => {
    const scaledElement = { ...element }
    
    // 为每个元素生成新的 id
    scaledElement.id = nanoid(10)
    
    // 缩放位置和尺寸（所有元素都有这些基础属性）
    scaledElement.left = element.left * ratio
    scaledElement.top = element.top * ratio
    scaledElement.width = element.width * ratio
    
    // 只有非线条元素才有height属性
    if (element.type !== 'line' && 'height' in element) {
      (scaledElement as any).height = (element as any).height * ratio
    }
    
    // 处理文本元素
    if (element.type === 'text') {
      const textElement = element as any
      const scaledTextElement = scaledElement as any
      if (textElement.content) {
        scaledTextElement.content = scaleHtmlContent(textElement.content, ratio)
      }
      // 处理文本元素的边框
      if (textElement.outline?.width) {
        scaledTextElement.outline = {
          ...textElement.outline,
          width: +(textElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理形状元素
    if (element.type === 'shape') {
      const shapeElement = element as any
      const scaledShapeElement = scaledElement as any
      // 处理形状内的文本
      if (shapeElement.text?.content) {
        scaledShapeElement.text = {
          ...shapeElement.text,
          content: scaleHtmlContent(shapeElement.text.content, ratio)
        }
      }
      // 处理形状边框
      if (shapeElement.outline?.width) {
        scaledShapeElement.outline = {
          ...shapeElement.outline,
          width: +(shapeElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理线条元素
    if (element.type === 'line') {
      const lineElement = element as any
      const scaledLineElement = scaledElement as any
      // 线条的宽度需要缩放
      scaledLineElement.width = +(lineElement.width * ratio).toFixed(2)
      // 处理线条的起点和终点
      if (lineElement.start) {
        scaledLineElement.start = [
          lineElement.start[0] * ratio,
          lineElement.start[1] * ratio
        ]
      }
      if (lineElement.end) {
        scaledLineElement.end = [
          lineElement.end[0] * ratio,
          lineElement.end[1] * ratio
        ]
      }
      // 处理折线的中间点
      if (lineElement.broken2) {
        scaledLineElement.broken2 = [
          lineElement.broken2[0] * ratio,
          lineElement.broken2[1] * ratio
        ]
      }
    }
    
    // 处理图片元素边框
    if (element.type === 'image') {
      const imageElement = element as any
      const scaledImageElement = scaledElement as any
      if (imageElement.outline?.width) {
        scaledImageElement.outline = {
          ...imageElement.outline,
          width: +(imageElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理表格元素
    if (element.type === 'table') {
      const tableElement = element as any
      const scaledTableElement = scaledElement as any
      // 处理表格边框
      if (tableElement.outline?.width) {
        scaledTableElement.outline = {
          ...tableElement.outline,
          width: +(tableElement.outline.width * ratio).toFixed(2)
        }
      }
      // 处理单元格最小高度
      if (tableElement.cellMinHeight) {
        scaledTableElement.cellMinHeight = tableElement.cellMinHeight * ratio
      }
      // 处理表格数据中的字体大小
      if (tableElement.data) {
        scaledTableElement.data = tableElement.data.map((row: any) => 
          row.map((cell: any) => ({
            ...cell,
            style: {
              ...cell.style,
              fontsize: cell.style?.fontsize ? scalePixelValue(cell.style.fontsize, ratio) : cell.style?.fontsize
            }
          }))
        )
      }
    }
    
    // 处理阴影（检查元素是否有shadow属性）
    const elementWithShadow = element as any
    const scaledElementWithShadow = scaledElement as any
    if (elementWithShadow.shadow) {
      scaledElementWithShadow.shadow = {
        ...elementWithShadow.shadow,
        h: elementWithShadow.shadow.h * ratio,
        v: elementWithShadow.shadow.v * ratio,
        blur: elementWithShadow.shadow.blur * ratio
      }
    }
    
    return scaledElement
  })
}

// 缩放HTML内容中的字体大小和其他尺寸
const scaleHtmlContent = (html: string, ratio: number) => {
  return html
    // 处理 font-size: XXpt 格式
    .replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理 font-size: XXpx 格式
    .replace(/font-size:\s*([\d.]+)px/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理行高
    .replace(/line-height:\s*([\d.]+)px/g, (match, p1) => {
      return `line-height: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理边距
    .replace(/margin:\s*([\d.]+)px/g, (match, p1) => {
      return `margin: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    .replace(/padding:\s*([\d.]+)px/g, (match, p1) => {
      return `padding: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
}

// 缩放像素值
const scalePixelValue = (value: string, ratio: number) => {
  if (!value) return value
  
  const match = value.match(/([\d.]+)px/)
  if (match) {
    return `${(parseFloat(match[1]) * ratio).toFixed(1)}px`
  }
  
  return value
}

// 应用固定视口设置
const applyFixedViewportSettings = (slideSize?: { width: number; height: number }) => {
  if (!slideSize) {
    slideSize = { width: 1280, height: 720 }
  }
  
  // 设置视口大小为固定的 1000px 宽度
  slidesStore.setViewportSize(1000)
  // 设置视口比例
  slidesStore.setViewportRatio(slideSize.height / slideSize.width)
  
  console.log(`设置固定视口: 宽度 1000px, 比例 ${slideSize.height / slideSize.width}`)
}

// 字体大小转换函数（从 pt 转换为 px）
const convertFontSizePtToPx = (html: string, ratio: number) => {
  return html.replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
    return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
  })
}



watch(handleElementId, () => {
  mainStore.setActiveGroupElementId('')
})

const elementList = ref<PPTElement[]>([])
const setLocalElementList = () => {
  elementList.value = currentSlide.value ? JSON.parse(JSON.stringify(currentSlide.value.elements)) : []
}
watchEffect(setLocalElementList)

const canvasRef = ref<HTMLElement>()
const { dragViewport, viewportStyles } = useViewportSize(canvasRef)

useDropImageOrText(canvasRef)

const { mouseSelection, mouseSelectionVisible, mouseSelectionQuadrant, updateMouseSelection } = useMouseSelection(elementList, viewportRef)

const { dragElement } = useDragElement(elementList, alignmentLines, canvasScale)
const { dragLineElement } = useDragLineElement(elementList)
const { selectElement } = useSelectAndMoveElement(elementList, dragElement)
const { scaleElement, scaleMultiElement } = useScaleElement(elementList, alignmentLines, canvasScale)
const { rotateElement } = useRotateElement(elementList, viewportRef, canvasScale)
const { moveShapeKeypoint } = useMoveShapeKeypoint(elementList, canvasScale)

const { selectAllElements } = useSelectElement()
const { deleteAllElements } = useDeleteElement()
const { pasteElement } = useCopyAndPasteElement()
const { enterScreeningFromStart } = useScreening()
const { updateSlideIndex } = useSlideHandler()
const { createTextElement, createShapeElement } = useCreateElement()
const { processTemplateImages, hasTemplateImages, getTemplateImageCount } = useTemplateAIImage()

// 启用 AI 数据同步
useAIDataSync()

// 组件渲染时，如果存在元素焦点，需要清除
// 这种情况存在于：有焦点元素的情况下进入了放映模式，再退出时，需要清除原先的焦点（因为可能已经切换了页面）
onMounted(() => {
  if (activeElementIdList.value.length) {
    nextTick(() => mainStore.setActiveElementIdList([]))
  }
  
  // 监听AI图片对话框打开事件
  emitter.on(EmitterEvents.OPEN_AI_IMAGE_DIALOG, openAIImageDialog)
})

onUnmounted(() => {
  // 清理事件监听器
  try {
    emitter.off(EmitterEvents.OPEN_AI_IMAGE_DIALOG, openAIImageDialog)
    if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
  }
  catch (error) {
    console.warn('清理事件监听器时出错:', error)
  }
})

// 点击画布的空白区域：清空焦点元素、设置画布焦点、清除文字选区、清空格式刷状态
const handleClickBlankArea = (e: MouseEvent) => {
  if (activeElementIdList.value.length) mainStore.setActiveElementIdList([])

  if (!spaceKeyState.value) updateMouseSelection(e)
  else dragViewport(e)

  if (!editorAreaFocus.value) mainStore.setEditorareaFocus(true)
  if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
  removeAllRanges()
}

// 双击空白处插入文本
const handleDblClick = (e: MouseEvent) => {
  if (activeElementIdList.value.length || creatingElement.value || creatingCustomShape.value) return
  if (!viewportRef.value) return

  const viewportRect = viewportRef.value.getBoundingClientRect()
  const left = (e.pageX - viewportRect.x) / canvasScale.value
  const top = (e.pageY - viewportRect.y) / canvasScale.value

  createTextElement({
    left,
    top,
    width: 200 / canvasScale.value, // 除以 canvasScale 是为了与点击选区创建的形式保持相同的宽度
    height: 0,
  })
}

// 移除画布编辑区域焦点
const removeEditorAreaFocus = () => {
  if (editorAreaFocus.value) mainStore.setEditorareaFocus(false)
}

// 滚动鼠标
const { scaleCanvas } = useScaleCanvas()
const throttleScaleCanvas = throttle(scaleCanvas, 100, { leading: true, trailing: false })
const throttleUpdateSlideIndex = throttle(updateSlideIndex, 300, { leading: true, trailing: false })

const handleMousewheelCanvas = (e: WheelEvent) => {
  e.preventDefault()

  // 按住Ctrl键时：缩放画布
  if (ctrlKeyState.value) {
    if (e.deltaY > 0) throttleScaleCanvas('-')
    else if (e.deltaY < 0) throttleScaleCanvas('+')
  }
  // 上下翻页
  else {
    if (e.deltaY > 0) throttleUpdateSlideIndex(KEYS.DOWN)
    else if (e.deltaY < 0) throttleUpdateSlideIndex(KEYS.UP)
  }
}

// 开关标尺
const toggleRuler = () => {
  mainStore.setRulerState(!showRuler.value)
}

// 在鼠标绘制的范围插入元素
const { insertElementFromCreateSelection, formatCreateSelection } = useInsertFromCreateSelection(viewportRef)

// 插入自定义任意多边形
const insertCustomShape = (data: CreateCustomShapeData) => {
  const {
    start,
    end,
    path,
    viewBox,
  } = data
  const position = formatCreateSelection({ start, end })
  if (position) {
    const supplement: Partial<PPTShapeElement> = {}
    if (data.fill) supplement.fill = data.fill
    if (data.outline) supplement.outline = data.outline
    createShapeElement(position, { path, viewBox }, supplement)
  }

  mainStore.setCreatingCustomShapeState(false)
}

const contextmenus = (): ContextmenuItem[] => {
  const baseMenus = [
    { text: '粘贴', subText: 'Ctrl + V', handler: pasteElement },
    { text: '全选', subText: 'Ctrl + A', handler: selectAllElements },
    { text: '标尺', subText: showRuler.value ? '√' : '', handler: toggleRuler },
    {
      text: '网格线', handler: () => mainStore.setGridLineSize(gridLineSize.value ? 0 : 50), children: [
        { text: '无', subText: gridLineSize.value === 0 ? '√' : '', handler: () => mainStore.setGridLineSize(0) },
        { text: '小', subText: gridLineSize.value === 25 ? '√' : '', handler: () => mainStore.setGridLineSize(25) },
        { text: '中', subText: gridLineSize.value === 50 ? '√' : '', handler: () => mainStore.setGridLineSize(50) },
        { text: '大', subText: gridLineSize.value === 100 ? '√' : '', handler: () => mainStore.setGridLineSize(100) }
      ]
    },
    { text: 'PPT模板制作', subText: '', handler: openMarkupPanel },
    { text: '重置当前页', handler: deleteAllElements },
    { divider: true },
  ]

  // 只有在标注模式下才显示保存模板按钮
  if (showMarkupPanel.value) {
    baseMenus.push({
      text: '保存模板',
      subText: '',
      handler: openSaveTemplateDialog,
    })
  }

  baseMenus.push(
    { text: '查看内容数据', subText: '', handler: openContentDataDialog },
    { text: '重新生成AI数据', subText: '', handler: regenerateAIData },
    { text: '手动选择模版', subText: '', handler: openManualTemplateSelect },
    { text: '自动匹配模板', subText: '', handler: matchTemplate },
    { text: 'AI 生成教学步骤', subText: '', handler: generateTeachingSteps }
  )

  // iframe 相关菜单
  baseMenus.push(isInteractiveTemplate.value ?
    {
      text: '退出互动模式', subText: '', handler: () => {
        isInteractiveTemplate.value = false
        message.success('已退出互动模式')
      }
    } :
    {
      text: '切换到互动模式', subText: '', handler: () => {
        isInteractiveTemplate.value = true
        message.success('已切换到互动模式')
      }
    }
  )
  baseMenus.push({ text: '幻灯片放映', subText: 'F5', handler: enterScreeningFromStart })

  return baseMenus
}

provide(injectKeySlideScale, canvasScale)
</script>

<style lang="scss" scoped>
.canvas {
  height: 100%;
  user-select: none;
  overflow: hidden;
  background-color: $lightGray;
  position: relative;
}

.drag-mask {
  cursor: grab;
  @include absolute-0();
}

.viewport-wrapper {
  position: absolute;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.01), 0 0 12px 0 rgba(0, 0, 0, 0.1);
}

.viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.content-data-dialog .data-content {
  max-height: 500px;
  overflow: auto;
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
}

.content-data-dialog .data-content pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
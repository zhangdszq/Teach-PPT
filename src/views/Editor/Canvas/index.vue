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
    <div 
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
import { nextTick, onMounted, onUnmounted, provide, ref, watch, watchEffect, computed } from 'vue'
import { throttle } from 'lodash'
import { storeToRefs } from 'pinia'
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
      } else {
        message.warning('未找到匹配的模板')
      }
    } else {
      message.error(data.message || '模板匹配失败')
    }
  } catch (error) {
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
  } catch (error) {
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
    {
      text: '粘贴',
      subText: 'Ctrl + V',
      handler: pasteElement,
    },
    {
      text: '全选',
      subText: 'Ctrl + A',
      handler: selectAllElements,
    },
    {
      text: '标尺',
      subText: showRuler.value ? '√' : '',
      handler: toggleRuler,
    },
    {
      text: '网格线',
      handler: () => mainStore.setGridLineSize(gridLineSize.value ? 0 : 50),
      children: [
        {
          text: '无',
          subText: gridLineSize.value === 0 ? '√' : '',
          handler: () => mainStore.setGridLineSize(0),
        },
        {
          text: '小',
          subText: gridLineSize.value === 25 ? '√' : '',
          handler: () => mainStore.setGridLineSize(25),
        },
        {
          text: '中',
          subText: gridLineSize.value === 50 ? '√' : '',
          handler: () => mainStore.setGridLineSize(50),
        },
        {
          text: '大',
          subText: gridLineSize.value === 100 ? '√' : '',
          handler: () => mainStore.setGridLineSize(100),
        },
      ],
    },
    {
      text: 'PPT模板制作',
      subText: '',
      handler: openMarkupPanel,
    },
    {
      text: '重置当前页',
      handler: deleteAllElements,
    },
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

  baseMenus.push({
    text: '查看内容数据',
    subText: '',
    handler: openContentDataDialog,
  })
  
  baseMenus.push({
    text: '自动匹配模板',
    subText: '',
    handler: matchTemplate,
  })
  
  baseMenus.push({
    text: '幻灯片放映',
    subText: 'F5',
    handler: enterScreeningFromStart,
  })

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

.content-data-dialog {
  .data-content {
    max-height: 500px;
    overflow: auto;
    background-color: #f5f5f5;
    border-radius: 4px;
    padding: 16px;
    
    pre {
      margin: 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}
</style>
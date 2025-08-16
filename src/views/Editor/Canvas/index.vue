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
    
    <!-- 互动模版 iframe -->
    <CanvasIframe
      :visible="isInteractiveTemplate"
      :viewportStyles="viewportStyles"
      :canvasScale="canvasScale"
      @update:visible="isInteractiveTemplate = $event"
    />

    <!-- 原始编辑器模式 -->
    <div 
      v-if="!isInteractiveTemplate"
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

    <!-- 模板管理器 -->
    <TemplateManager ref="templateManagerRef" />
    
    <!-- AI管理器 -->
    <AIManager ref="aiManagerRef" />
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch, watchEffect } from 'vue'
import { throttle } from 'lodash'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore, useKeyboardStore } from '@/store'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import type { PPTElement, PPTShapeElement } from '@/types/slides'
import type { AlignmentLineProps, CreateCustomShapeData } from '@/types/edit'
import { injectKeySlideScale } from '@/types/injectKey'
import { removeAllRanges } from '@/utils/selection'
import { KEYS } from '@/configs/hotkey'

// Hooks
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

// Components
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
import Modal from '@/components/Modal.vue'

// 新拆分的组件
import CanvasIframe from './components/CanvasIframe.vue'
import TemplateManager from './components/TemplateManager.vue'
import AIManager from './components/AIManager.vue'

// Composables
import { useSlideInteractiveStates } from './composables/useTemplateProcessor'
import { useAIDataProcessor } from './composables/useAIDataProcessor'

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

// 组件引用
const canvasRef = ref<HTMLElement>()
const viewportRef = ref<HTMLElement>()
const templateManagerRef = ref<InstanceType<typeof TemplateManager>>()
const aiManagerRef = ref<InstanceType<typeof AIManager>>()

// 对齐线
const alignmentLines = ref<AlignmentLineProps[]>([])

// 链接对话框
const linkDialogVisible = ref(false)
const openLinkDialog = () => linkDialogVisible.value = true

// AI图片对话框
const openAIImageDialog = () => {
  if (aiManagerRef.value) {
    aiManagerRef.value.openAIImageDialog()
  }
}

// 使用组合式函数
const { isInteractiveTemplate, handleSlideChange } = useSlideInteractiveStates()
useAIDataProcessor()

// 监听幻灯片切换
watch(() => slideIndex.value, (newIndex, oldIndex) => {
  handleSlideChange(newIndex, oldIndex)
}, { immediate: true })

// 监听 handleElementId 变化
watch(handleElementId, () => {
  mainStore.setActiveGroupElementId('')
})

// 元素列表
const elementList = ref<PPTElement[]>([])
const setLocalElementList = () => {
  elementList.value = currentSlide.value ? JSON.parse(JSON.stringify(currentSlide.value.elements)) : []
}
watchEffect(setLocalElementList)

// 视口相关
const { dragViewport, viewportStyles } = useViewportSize(canvasRef)

// 拖放图片或文本
useDropImageOrText(canvasRef)

// 鼠标选择框
const { mouseSelection, mouseSelectionVisible, mouseSelectionQuadrant, updateMouseSelection } = useMouseSelection(elementList, viewportRef)

// 元素操作
const { dragElement } = useDragElement(elementList, alignmentLines, canvasScale)
const { dragLineElement } = useDragLineElement(elementList)
const { selectElement } = useSelectAndMoveElement(elementList, dragElement)
const { scaleElement, scaleMultiElement } = useScaleElement(elementList, alignmentLines, canvasScale)
const { rotateElement } = useRotateElement(elementList, viewportRef, canvasScale)
const { moveShapeKeypoint } = useMoveShapeKeypoint(elementList, canvasScale)

// 其他操作
const { selectAllElements } = useSelectElement()
const { deleteAllElements } = useDeleteElement()
const { pasteElement } = useCopyAndPasteElement()
const { enterScreeningFromStart } = useScreening()
const { updateSlideIndex } = useSlideHandler()
const { createTextElement, createShapeElement } = useCreateElement()

// 组件生命周期
onMounted(() => {
  if (activeElementIdList.value.length) {
    nextTick(() => mainStore.setActiveElementIdList([]))
  }
})

onUnmounted(() => {
  if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
})

// 点击画布空白区域
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
    width: 200 / canvasScale.value,
    height: 0,
  })
}

// 移除编辑区域焦点
const removeEditorAreaFocus = () => {
  if (editorAreaFocus.value) mainStore.setEditorareaFocus(false)
}

// 缩放画布
const { scaleCanvas } = useScaleCanvas()
const throttleScaleCanvas = throttle(scaleCanvas, 100, { leading: true, trailing: false })
const throttleUpdateSlideIndex = throttle(updateSlideIndex, 300, { leading: true, trailing: false })

// 鼠标滚轮处理
const handleMousewheelCanvas = (e: WheelEvent) => {
  e.preventDefault()

  if (ctrlKeyState.value) {
    if (e.deltaY > 0) throttleScaleCanvas('-')
    else if (e.deltaY < 0) throttleScaleCanvas('+')
  }
  else {
    if (e.deltaY > 0) throttleUpdateSlideIndex(KEYS.DOWN)
    else if (e.deltaY < 0) throttleUpdateSlideIndex(KEYS.UP)
  }
}

// 开关标尺
const toggleRuler = () => {
  mainStore.setRulerState(!showRuler.value)
}

// 打开标注面板
const openMarkupPanel = () => {
  mainStore.setMarkupPanelState(true)
}

// 插入元素
const { insertElementFromCreateSelection, formatCreateSelection } = useInsertFromCreateSelection(viewportRef)

// 插入自定义形状
const insertCustomShape = (data: CreateCustomShapeData) => {
  const { start, end, path, viewBox } = data
  const position = formatCreateSelection({ start, end })
  if (position) {
    const supplement: Partial<PPTShapeElement> = {}
    if (data.fill) supplement.fill = data.fill
    if (data.outline) supplement.outline = data.outline
    createShapeElement(position, { path, viewBox }, supplement)
  }
  mainStore.setCreatingCustomShapeState(false)
}

// 右键菜单
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
      handler: () => templateManagerRef.value?.openSaveTemplateDialog(),
    })
  }

  // 模板和AI相关菜单
  baseMenus.push(
    { text: '查看内容数据', subText: '', handler: () => templateManagerRef.value?.openContentDataDialog() },
    { text: '重新生成AI数据', subText: '', handler: () => templateManagerRef.value?.regenerateAIData() },
    { text: '手动选择模版', subText: '', handler: () => templateManagerRef.value?.openManualTemplateSelect() },
    { text: '自动匹配模板', subText: '', handler: () => templateManagerRef.value?.matchTemplate() },
    { text: 'AI 生成教学步骤', subText: '', handler: () => aiManagerRef.value?.generateTeachingSteps() }
  )

  // iframe 相关菜单
  baseMenus.push(isInteractiveTemplate.value ?
    {
      text: '退出互动模式', subText: '', handler: () => {
        isInteractiveTemplate.value = false
      }
    } :
    {
      text: '切换到互动模式', subText: '', handler: () => {
        isInteractiveTemplate.value = true
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
</style>
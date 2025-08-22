<template>
  <div>
    <!-- 保存模板对话框 -->
    <SaveTemplateDialog 
      :visible="saveTemplateDialogVisible"
      @close="saveTemplateDialogVisible = false"
    />

    <!-- 手动选择模板对话框 -->
    <TemplateSelectDialog 
      :visible="manualTemplateSelectVisible"
      :aiData="currentSlideData?.aiData || null"
      @close="closeManualTemplateSelect"
      @select="handleManualTemplateSelect"
    />

    <!-- 查看内容数据对话框 -->
    <Modal
      v-model:visible="contentDataDialogVisible" 
      :width="900"
      title="编辑内容数据"
    >
      <div class="content-data-dialog">
        <div class="data-content">
          <div class="json-editor-container">
            <div class="editor-toolbar">
              <div class="toolbar-left">
                <span class="text-sm text-gray-600">JSON 数据编辑器</span>
              </div>
              <div class="toolbar-right">
                <button 
                  @click="formatJSON" 
                  class="format-btn"
                  title="格式化JSON"
                >
                  格式化
                </button>
                <button 
                  @click="validateJSON" 
                  class="validate-btn"
                  title="验证JSON"
                >
                  验证
                </button>
              </div>
            </div>
            <div class="editor-with-lines">
              <div class="line-numbers" ref="lineNumbersRef">
                <div 
                  v-for="lineNumber in lineCount" 
                  :key="lineNumber" 
                  class="line-number"
                >
                  {{ lineNumber }}
                </div>
              </div>
              <textarea
                v-model="editableContentData"
                class="json-editor"
                placeholder="请输入有效的JSON数据..."
                @input="onJSONInput"
                @scroll="syncScroll"
                ref="textareaRef"
              ></textarea>
            </div>
          </div>
          
          <div v-if="jsonError" class="json-error">
            <span class="error-icon">⚠️</span>
            <span class="error-text">{{ jsonError }}</span>
          </div>
        </div>
        <div class="dialog-footer">
          <button @click="contentDataDialogVisible = false" class="cancel-btn">
            取消
          </button>
          <button 
            @click="saveContentData" 
            class="save-btn"
            :disabled="!!jsonError || !hasChanges"
          >
            保存更改
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useSlidesStore, useMainStore } from '@/store'
import useTemplateAIImageMethods from '@/hooks/useTemplateAIImageMethods'
import useInteractiveImageGeneration from '@/hooks/useInteractiveImageGeneration'
import api from '@/services'
import message from '@/utils/message'
import SaveTemplateDialog from '../../SaveTemplateDialog.vue'
import TemplateSelectDialog from '../../TemplateSelectDialog.vue'
import Modal from '@/components/Modal.vue'
import { processElementsWithFixedViewport, applyFixedViewportSettings } from '../utils/elementScaler'

const slidesStore = useSlidesStore()
const mainStore = useMainStore()
const { currentSlide, slideIndex, slides } = storeToRefs(slidesStore)
const { showMarkupPanel } = storeToRefs(mainStore)

const saveTemplateDialogVisible = ref(false)
const manualTemplateSelectVisible = ref(false)
const contentDataDialogVisible = ref(false)
const currentSlideData = ref<any>(null)
const editableContentData = ref('')
const originalContentData = ref('')
const jsonError = ref('')
const textareaRef = ref()
const lineNumbersRef = ref()

const { processTemplateImages, hasTemplateImages, getTemplateImageCount } = useTemplateAIImageMethods()
const { hasInteractiveImages, processInteractiveImages } = useInteractiveImageGeneration()

const formattedContentData = computed(() => {
  if (!currentSlideData.value) return '暂无数据'
  return JSON.stringify(currentSlideData.value, null, 2)
})

const hasChanges = computed(() => {
  return editableContentData.value !== originalContentData.value
})

const lineCount = computed(() => {
  return editableContentData.value.split('\n').length
})

// 打开保存模板对话框
const openSaveTemplateDialog = () => {
  if (!currentSlide.value) {
    message.error('当前页面为空，无法保存为模板')
    return
  }
  saveTemplateDialogVisible.value = true
}

// 打开查看内容数据对话框
const openContentDataDialog = () => {
  const slide = slides.value[slideIndex.value]
  if (!slide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  // 构建完整的幻灯片数据对象（不包含 elements 字段）
  const slideData = {
    id: slide.id,
    background: slide.background,
    animations: slide.animations,
    turningMode: slide.turningMode,
    remark: slide.remark,
    ...(slide.aiData && { aiData: slide.aiData }),
    ...(slide.templateData && { templateData: slide.templateData }),
    ...(slide.isInteractive !== undefined && { isInteractive: slide.isInteractive }),
    ...(slide.iframeSrc && { iframeSrc: slide.iframeSrc })
    // 注意：故意不包含 elements 字段
  }
  
  currentSlideData.value = slideData
  const jsonString = JSON.stringify(slideData, null, 2)
  editableContentData.value = jsonString
  originalContentData.value = jsonString
  jsonError.value = ''
  contentDataDialogVisible.value = true
}

// JSON输入处理
const onJSONInput = () => {
  validateJSON()
}

// 同步滚动
const syncScroll = () => {
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

// 验证JSON
const validateJSON = () => {
  try {
    JSON.parse(editableContentData.value)
    jsonError.value = ''
    return true
  } 
  catch (error: any) {
    jsonError.value = `JSON格式错误: ${error.message}`
    return false
  }
}

// 格式化JSON
const formatJSON = () => {
  if (validateJSON()) {
    try {
      const parsed = JSON.parse(editableContentData.value)
      editableContentData.value = JSON.stringify(parsed, null, 2)
      message.success('JSON格式化成功')
    } 
    catch (error) {
      message.error('JSON格式化失败')
    }
  }
}

// 保存内容数据
const saveContentData = () => {
  if (!validateJSON()) {
    message.error('请修复JSON格式错误后再保存')
    return
  }
  
  try {
    const parsedData = JSON.parse(editableContentData.value)
    
    // 更新当前幻灯片数据
    slidesStore.updateSlide({
      background: parsedData.background,
      animations: parsedData.animations,
      turningMode: parsedData.turningMode,
      remark: parsedData.remark,
      aiData: parsedData.aiData,
      templateData: parsedData.templateData,
      isInteractive: parsedData.isInteractive,
      iframeSrc: parsedData.iframeSrc
    })
    
    // 更新当前数据引用
    currentSlideData.value = parsedData
    originalContentData.value = editableContentData.value
    
    message.success('内容数据保存成功')
    contentDataDialogVisible.value = false
  } 
  catch (error: any) {
    message.error(`保存失败: ${error.message}`)
  }
}

// 重新生成AI数据
const regenerateAIData = async () => {
  const slide = slides.value[slideIndex.value]
  if (!slide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  if (!slide.aiData || !slide.aiData.content) {
    message.warning('当前幻灯片没有AI生成的内容数据')
    return
  }

  try {
    message.info('正在重新生成AI数据...')
    
    const response = await api.regenerateAIData({
      content: slide.aiData.content,
      pageNumber: slideIndex.value + 1,
      totalPages: slides.value.length
    })
    
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      slidesStore.updateSlide({
        aiData: data.data
      })
      
      // 重新构建完整的幻灯片数据（不包含 elements 字段）
      const slide = slides.value[slideIndex.value]
      const slideData = {
        id: slide.id,
        background: slide.background,
        animations: slide.animations,
        turningMode: slide.turningMode,
        remark: slide.remark,
        aiData: data.data,
        ...(slide.templateData && { templateData: slide.templateData }),
        ...(slide.isInteractive !== undefined && { isInteractive: slide.isInteractive }),
        ...(slide.iframeSrc && { iframeSrc: slide.iframeSrc })
        // 注意：故意不包含 elements 字段
      }
      currentSlideData.value = slideData
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

// 自动匹配模板
const matchTemplate = async () => {
  const slide = slides.value[slideIndex.value]
  if (!slide) {
    message.warning('当前没有选中的幻灯片')
    return
  }

  try {
    message.info('正在匹配模板...')
    
    const response = await api.matchTemplate(slide.aiData)
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      const matchResults = data.data
      if (matchResults.length > 0) {
        message.success(`找到 ${matchResults.length} 个匹配的模板`)
        console.log('模板匹配结果:', matchResults)
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

// 打开手动选择模板对话框
const openManualTemplateSelect = () => {
  const slide = slides.value[slideIndex.value]
  if (!slide) {
    message.warning('当前没有选中的幻灯片')
    return
  }
  
  if (!slide.aiData) {
    message.warning('当前幻灯片没有AI生成的数据，无法进行模版匹配')
    return
  }
  
  // 为手动模板选择保存aiData
  const aiDataForTemplate = slide.aiData || {}
  currentSlideData.value = { aiData: aiDataForTemplate }
  manualTemplateSelectVisible.value = true
}

// 关闭手动选择模板对话框
const closeManualTemplateSelect = () => {
  manualTemplateSelectVisible.value = false
}

// 处理手动选择模板
const handleManualTemplateSelect = async (template: any) => {
  try {
    message.info('正在应用选择的模版...')
    
    const slide = slides.value[slideIndex.value]
    if (!slide || !slide.aiData) {
      message.error('当前幻灯片数据异常')
      return
    }

    const response = await api.useTemplate({
      templateId: template.id,
      aiData: slide.aiData
    })
    
    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      const responseData = data.data
      
      if (responseData.slides && responseData.slides.length > 0) {
        const newSlideData = responseData.slides[0]
        
        if (newSlideData.elements && Array.isArray(newSlideData.elements)) {
          const slideSize = {
            width: responseData.width || 1280,
            height: responseData.height || 720
          }
          
          const processedElements = processElementsWithFixedViewport(newSlideData.elements, slideSize)
          
          slidesStore.updateSlide({
            elements: processedElements,
            background: newSlideData.background || slide.background,
            aiData: slide.aiData,
            templateData: newSlideData.templateData,
            isInteractive: newSlideData.isInteractive,
            imageConfig: newSlideData.imageConfig
          })
          
          applyFixedViewportSettings(slidesStore, slideSize)
          
          message.success(`成功应用模版：${template.name}`)
          
          nextTick(() => {
            // 处理普通模版图片
            if (hasTemplateImages()) {
              const imageCount = getTemplateImageCount()
              message.info(`检测到 ${imageCount} 个图片需要AI生成，正在处理...`)
              processTemplateImages(slideIndex.value)
            }
            
            // 处理互动模版图片
            // 使用完整的后端响应数据来检查互动图片
            const slideDataForInteractive = {
              ...newSlideData,
              id: slideIndex.value.toString(),
              elements: processedElements
            }
            
            console.log('🔍 当前幻灯片数据结构:', {
              slideIndex: slideIndex.value,
              slideId: slideDataForInteractive.id,
              hasTemplateData: !!slideDataForInteractive.templateData,
              hasAiData: !!slideDataForInteractive.aiData,
              isInteractive: slideDataForInteractive.isInteractive,
              slideKeys: Object.keys(slideDataForInteractive),
              templateDataKeys: slideDataForInteractive.templateData ? Object.keys(slideDataForInteractive.templateData) : null
            })
            
            console.log('📋 准备调用 hasInteractiveImages，参数详情:', {
              slideDataForInteractive,
              isUndefined: slideDataForInteractive === undefined,
              isNull: slideDataForInteractive === null,
              type: typeof slideDataForInteractive,
              hasInteractiveImagesFn: typeof hasInteractiveImages,
              hasInteractiveImagesExists: !!hasInteractiveImages
            })
            
            if (hasInteractiveImages && hasInteractiveImages(slideDataForInteractive)) {
              console.log('🎭 检测到互动模版图片，添加到统一队列')
              // 使用包含完整后端响应数据的 slideDataForInteractive
              processInteractiveImages(slideIndex.value, slideDataForInteractive)
            }
          })
        }
        else {
          message.warning('模版数据格式异常：缺少有效的元素数据')
        }
      }
      else {
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

// 导出方法供父组件使用
defineExpose({
  openSaveTemplateDialog,
  openContentDataDialog,
  regenerateAIData,
  matchTemplate,
  openManualTemplateSelect,
  showMarkupPanel
})
</script>

<style lang="scss" scoped>
.content-data-dialog {
  .data-content {
    margin-bottom: 16px;
  }
  
  .json-editor-container {
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #e1e5e9;
    
    .toolbar-left {
      display: flex;
      align-items: center;
    }
    
    .toolbar-right {
      display: flex;
      gap: 8px;
    }
    
    .format-btn, .validate-btn {
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid #d0d7de;
      border-radius: 4px;
      background: #fff;
      color: #656d76;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: #f3f4f6;
        border-color: #8c959f;
      }
    }
  }
  
  .editor-with-lines {
    display: flex;
    position: relative;
    height: 400px;
  }
  
  .line-numbers {
    background: #f5f5f5;
    border-right: 1px solid #e1e5e9;
    color: #8c959f;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    padding: 12px 8px 12px 12px;
    text-align: right;
    user-select: none;
    min-width: 40px;
    overflow: hidden;
    white-space: nowrap;
  }
  
  .line-number {
    height: 19.5px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  
  .json-editor {
    flex: 1;
    height: 100%;
    padding: 12px;
    border: none;
    outline: none;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #24292f;
    background: #fff;
    resize: none;
    
    &::placeholder {
      color: #8c959f;
    }
  }
  
  .json-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    margin-top: 8px;
    background: #fff5f5;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #dc2626;
    font-size: 12px;
    
    .error-icon {
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .error-text {
      flex: 1;
      line-height: 1.4;
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #e1e5e9;
    
    .cancel-btn, .save-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid;
    }
    
    .cancel-btn {
      background: #fff;
      color: #656d76;
      border-color: #d0d7de;
      
      &:hover {
        background: #f3f4f6;
        border-color: #8c959f;
      }
    }
    
    .save-btn {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
      
      &:hover:not(:disabled) {
        background: #1d4ed8;
        border-color: #1d4ed8;
      }
      
      &:disabled {
        background: #9ca3af;
        border-color: #9ca3af;
        cursor: not-allowed;
        opacity: 0.6;
      }
    }
  }
}
</style>
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
import { ref, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useSlidesStore, useMainStore } from '@/store'
import useTemplateAIImageMethods from '@/hooks/useTemplateAIImageMethods'
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

const { processTemplateImages, hasTemplateImages, getTemplateImageCount } = useTemplateAIImageMethods()

const formattedContentData = computed(() => {
  if (!currentSlideData.value) return '暂无数据'
  return JSON.stringify(currentSlideData.value, null, 2)
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
  contentDataDialogVisible.value = true
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
            aiData: slide.aiData
          })
          
          applyFixedViewportSettings(slidesStore, slideSize)
          
          message.success(`成功应用模版：${template.name}`)
          
          nextTick(() => {
            if (hasTemplateImages()) {
              const imageCount = getTemplateImageCount()
              message.info(`检测到 ${imageCount} 个图片需要AI生成，正在处理...`)
              processTemplateImages(slideIndex.value)
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
<template>
  <div>
    <!-- AI图片对话框 -->
    <AIImageDialog 
      :visible="aiImageDialogVisible"
      @close="aiImageDialogVisible = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import message from '@/utils/message'
import emitter, { EmitterEvents } from '@/utils/emitter'
import AIImageDialog from '../../AIImageDialog.vue'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { handleElementId } = storeToRefs(mainStore)
const { currentSlide, slideIndex, slides } = storeToRefs(slidesStore)

const aiImageDialogVisible = ref(false)

// 获取当前幻灯片元素列表
const getElementList = () => {
  return currentSlide.value ? currentSlide.value.elements : []
}

// 打开AI图片对话框
const openAIImageDialog = () => {
  if (handleElementId.value) {
    const element = getElementList().find(el => el.id === handleElementId.value)
    if (element && element.type === 'image') {
      aiImageDialogVisible.value = true
    }
  }
}

// AI生成教学步骤
const generateTeachingSteps = async () => {
  const slide = slides.value[slideIndex.value]
  if (!slide) {
    message.warning('当前没有选中的幻灯片')
    return
  }

  try {
    message.info('正在截图并生成教学步骤...')
    
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 查找目标元素进行截图
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
    
    // 使用工具类截图
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
        aiData: slide.aiData
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.status === 'success' && result.data) {
      const teachingStepsContent = result.data
      
      if (teachingStepsContent.trim()) {
        slidesStore.updateSlide({
          remark: teachingStepsContent
        }, slide.id)
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

// 监听事件
onMounted(() => {
  emitter.on(EmitterEvents.OPEN_AI_IMAGE_DIALOG, openAIImageDialog)
})

onUnmounted(() => {
  try {
    emitter.off(EmitterEvents.OPEN_AI_IMAGE_DIALOG, openAIImageDialog)
  }
  catch (error) {
    console.warn('清理事件监听器时出错:', error)
  }
})

// 导出方法
defineExpose({
  openAIImageDialog,
  generateTeachingSteps
})
</script>
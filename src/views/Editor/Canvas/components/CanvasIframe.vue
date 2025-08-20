<template>
  <iframe 
    v-if="visible"
    ref="iframeRef"
    class="interactive-template-iframe"
    :style="iframeStyles"
    :src="iframeUrl"
    frameborder="0"
    allowfullscreen
  ></iframe>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import useInteractiveImageGeneration from '@/hooks/useInteractiveImageGeneration'
import message from '@/utils/message'

interface Props {
  visible: boolean
  viewportStyles: {
    width: number
    height: number
    left: number
    top: number
  }
  canvasScale: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const slidesStore = useSlidesStore()
const { slideIndex, slides } = storeToRefs(slidesStore)
const { processInteractiveImages, hasInteractiveImages } = useInteractiveImageGeneration()

const iframeRef = ref<HTMLIFrameElement>()

// 从当前幻灯片获取 iframe URL
const iframeUrl = computed(() => {
  const currentSlide = slides.value[slideIndex.value]
  return currentSlide?.iframeSrc || 'public/interactive-quiz.html'
})

const iframeStyles = computed(() => ({
  width: props.viewportStyles.width * props.canvasScale + 'px',
  height: props.viewportStyles.height * props.canvasScale + 'px',
  left: props.viewportStyles.left + 'px',
  top: props.viewportStyles.top + 'px',
  position: 'absolute' as const,
  border: 'none',
  borderRadius: '8px',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
}))

// 发送消息到iframe
const sendMessageToIframe = (message: any) => {
  if (iframeRef.value?.contentWindow) {
    try {
      const clonedMessage = JSON.parse(JSON.stringify(message))
      iframeRef.value.contentWindow.postMessage(clonedMessage, '*')
    }
    catch (error) {
      console.error('发送消息到iframe失败:', error)
    }
  }
}

// 处理来自iframe的消息
const handleIframeMessage = async (event: MessageEvent) => {
  console.log('收到来自 iframe 的消息:', event.data)
  
  if (event.data.type === 'iframeReady') {
    // iframe准备就绪，发送初始化数据
    const currentSlide = slides.value[slideIndex.value]
    
    console.log('🔍 当前幻灯片数据结构:', {
      slideIndex: slideIndex.value,
      slideId: currentSlide?.id,
      hasTemplateData: !!currentSlide?.templateData,
      hasAiData: !!currentSlide?.aiData,
      isInteractive: currentSlide?.isInteractive,
      templateDataKeys: currentSlide?.templateData ? Object.keys(currentSlide.templateData) : [],
      slideKeys: currentSlide ? Object.keys(currentSlide) : []
    })
    
    // 检查是否需要生成互动图片
    if (currentSlide?.isInteractive && hasInteractiveImages()) {
      console.log('🎮 检测到互动模式需要生成图片，开始处理...')
      try {
        await processInteractiveImages()
        console.log('✅ 互动图片生成完成')
      }
      catch (error) {
        console.error('❌ 互动图片生成失败:', error)
      }
    }
    
    // 直接从幻灯片的templateData字段获取数据
    if (currentSlide?.templateData) {
      console.log('✅ 发送互动模板数据到iframe:', currentSlide.templateData)
      sendMessageToIframe({
        type: 'initData',
        data: currentSlide.templateData
      })
    }
    else {
      console.warn('❌ 当前幻灯片没有templateData数据')
    }
  }
  else if (event.data.type === 'requestAIData') {
    // iframe请求AI数据
    const currentSlide = slides.value[slideIndex.value]
    sendMessageToIframe({
      type: 'aiDataResponse',
      data: currentSlide?.aiData || null
    })
  }
  else if (event.data.type === 'question-result') {
    // 处理问题答题结果
    handleQuestionResult(event.data)
  }
  else if (event.data.type === 'testMessage') {
    // 处理测试消息
    console.log('收到iframe测试消息:', event.data.data)
    message.info(`iframe消息: ${event.data.data}`)
  }
}

// 处理问题答题结果
const handleQuestionResult = (result: any) => {
  const { questionId, selectedOption, isCorrect, timeSpent } = result.data
  
  // 记录答题结果
  console.log(`问题 ${questionId} 答题结果:`, {
    选项: selectedOption,
    正确: isCorrect,
    用时: timeSpent
  })
  
  // 显示答题反馈
  if (isCorrect) {
    message.success(`回答正确！用时 ${timeSpent}ms`)
  }
  else {
    message.error(`回答错误，正确答案是其他选项`)
  }
}

// 切换互动模式
const toggleInteractiveMode = () => {
  emit('update:visible', !props.visible)
  message.success(props.visible ? '已退出互动模式' : '已切换到互动模式')
}

// 监听幻灯片切换，确保互动模板之间切换时重新发送数据
watch(
  () => slideIndex.value,
  (newIndex, oldIndex) => {
    if (newIndex !== oldIndex) {
      const currentSlide = slides.value[newIndex]
      const oldSlide = slides.value[oldIndex]
      
      // 如果新幻灯片是互动模板且与旧幻灯片不同
      if (currentSlide?.type === 'iframe' && currentSlide.id !== oldSlide?.id) {
        console.log('🔄 检测到互动模板切换，准备重新发送数据')
        console.log('📊 切换详情:', {
          从: oldSlide?.id,
          到: currentSlide.id,
          新幻灯片类型: currentSlide.type,
          有templateData: !!currentSlide.templateData,
          iframe可见: props.visible
        })
        
        // 延迟发送，确保iframe已经更新
        setTimeout(() => {
          if (currentSlide.templateData && props.visible) {
            console.log('✅ 重新发送互动模板数据到iframe:', currentSlide.templateData)
            sendMessageToIframe({
              type: 'initData',
              data: currentSlide.templateData
            })
          } else {
            console.warn('❌ 无法发送数据:', {
              有templateData: !!currentSlide.templateData,
              iframe可见: props.visible
            })
          }
        }, 300) // 增加延迟确保iframe完全加载
      }
    }
  }
)

// 监听当前幻灯片的templateData变化
watch(
  () => {
    const currentSlide = slides.value[slideIndex.value]
    return currentSlide?.templateData
  },
  (newTemplateData) => {
    const currentSlide = slides.value[slideIndex.value]
    if (currentSlide?.type === 'iframe' && newTemplateData && props.visible) {
      console.log('📊 检测到templateData变化，重新发送数据')
      sendMessageToIframe({
        type: 'initData',
        data: newTemplateData
      })
    }
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
})

defineExpose({
  toggleInteractiveMode,
  sendMessageToIframe
})
</script>

<style lang="scss" scoped>
.interactive-template-iframe {
  z-index: 10;
}
</style>
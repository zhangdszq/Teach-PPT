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

const iframeRef = ref<HTMLIFrameElement>()
const iframeUrl = ref('public/interactive-quiz.html')

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

// 切换互动模式
const toggleInteractiveMode = () => {
  emit('update:visible', !props.visible)
  message.success(props.visible ? '已退出互动模式' : '已切换到互动模式')
}

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
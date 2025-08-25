<template>
  <Modal 
    :visible="visible" 
    :width="540"
    @update:visible="emit('close')"
  >
    <div class="ai-image-dialog">
      <div class="header">
        <div class="title">AI生成图片</div>
      </div>
      
      <div class="content">
        <div class="form-item">
          <div class="label">图片描述：</div>
          <TextArea
            v-model:value="prompt"
            :rows="4"
            placeholder="请描述您想要生成的图片内容，例如：一只可爱的小猫坐在窗台上，阳光透过窗户洒在它身上"
            :disabled="isGenerating"
          />
        </div>
        
        <div class="form-item">
          <div class="label">生成模型：</div>
          <Select
            v-model:value="selectedModel"
            :options="modelOptions"
            :disabled="isGenerating"
          />
        </div>
        
        <div class="tips">
          <div class="tip-item">💡 提示：描述越详细，生成的图片效果越好</div>
          <div class="tip-item">🎨 即梦服务：专业的卡通风格图片生成，图片中不会包含文字</div>
          <div class="tip-item">⚡ 生成时间约需要10-30秒，请耐心等待</div>
        </div>
      </div>

      <div class="footer">
        <div class="btns">
          <Button class="btn close" @click="emit('close')">取消</Button>
          <Button 
            class="btn generate" 
            type="primary" 
            :loading="isGenerating"
            @click="handleGenerate()"
          >
            {{ isGenerating ? '生成中...' : '生成图片' }}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import useAIImageGeneration from '@/hooks/useAIImageGeneration'
import Modal from '@/components/Modal.vue'
import TextArea from '@/components/TextArea.vue'
import Select from '@/components/Select.vue'
import Button from '@/components/Button.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { handleElementId } = storeToRefs(mainStore)
const { slideIndex } = storeToRefs(slidesStore)

const { isGenerating, generateAIImage } = useAIImageGeneration()

const prompt = ref('')
const selectedModel = ref('jimeng')

// 固定记录对话框打开时的slideIndex和elementId，避免用户切换幻灯片时出现错误
const fixedSlideIndex = ref<number>(0)
const fixedElementId = ref<string>('')

const modelOptions = [
  { label: '即梦 (火山引擎) - 推荐', value: 'jimeng' },
  { label: 'DALL-E 3', value: 'dall-e-3' },
  { label: 'DALL-E 2', value: 'dall-e-2' },
  { label: 'Stable Diffusion', value: 'stable-diffusion' },
]

// 监听对话框显示状态，当显示时固定记录slideIndex和elementId，并获取alt描述
watch(() => props.visible, (newVisible) => {
  if (newVisible && handleElementId.value) {
    // 固定记录当前的slideIndex和elementId
    fixedSlideIndex.value = slideIndex.value
    fixedElementId.value = handleElementId.value
    
    const currentSlide = slidesStore.currentSlide
    const element = currentSlide.elements.find(el => el.id === handleElementId.value)
    
    // 验证slideIndex和实际幻灯片的一致性
    const slideById = slidesStore.slides.find(slide => slide.id === currentSlide.id)
    const actualSlideIndex = slidesStore.slides.findIndex(slide => slide.id === currentSlide.id)
    
    // 输出详细的调试信息
    console.log(`🎯 AI图片对话框打开:`, {
      fixedSlideIndex: fixedSlideIndex.value,
      fixedElementId: fixedElementId.value,
      currentSlideId: currentSlide.id,
      actualSlideIndex: actualSlideIndex,
      slideIndexMatch: fixedSlideIndex.value === actualSlideIndex,
      elementExists: !!element,
      elementType: element?.type,
      totalElements: currentSlide.elements.length,
      totalSlides: slidesStore.slides.length
    })
    
    // 输出slides数组的详细信息
    console.log(`📋 幻灯片数组详情:`, {
      slidesArray: slidesStore.slides.map((slide, idx) => ({
        index: idx,
        id: slide.id,
        isCurrent: idx === fixedSlideIndex.value,
        isCurrentSlideId: slide.id === currentSlide.id
      })),
      currentSlideFromGetter: {
        id: currentSlide.id,
        fromIndex: fixedSlideIndex.value
      },
      slideAtActualIndex: actualSlideIndex >= 0 ? {
        id: slidesStore.slides[actualSlideIndex]?.id,
        index: actualSlideIndex
      } : null
    })
    
    // 如果发现索引不一致，使用实际的索引
    if (fixedSlideIndex.value !== actualSlideIndex && actualSlideIndex !== -1) {
      console.warn(`⚠️ 检测到索引不一致: slideIndex=${fixedSlideIndex.value}, 实际索引=${actualSlideIndex}，已修正`)
      fixedSlideIndex.value = actualSlideIndex
    }
    
    if (element && element.type === 'image' && element.alt) {
      prompt.value = element.alt
    }
  }
})

const handleGenerate = () => {
  if (!prompt.value.trim()) return
  
  console.log(`🎯 AI图片生成: 使用固定的幻灯片索引 ${fixedSlideIndex.value}, 元素ID ${fixedElementId.value}`)
  
  // 立即关闭对话框，不影响用户继续操作
  emit('close')
  
  // 在后台异步生成图片，使用固定记录的slideIndex和elementId参数
  generateAIImage(
    prompt.value, 
    selectedModel.value, 
    undefined, // width
    undefined, // height
    fixedSlideIndex.value, 
    fixedElementId.value
  )
}
</script>

<style lang="scss" scoped>
.ai-image-dialog {
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e8e8e8;
    
    .title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
  }

  .content {
    margin-bottom: 20px;
  }

  .form-item {
    margin-bottom: 20px;
    
    .label {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #333;
    }
  }

  .tips {
    background: #f8f9fa;
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
    
    .tip-item {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 4px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .footer {
    padding-top: 16px;
    border-top: 1px solid #e8e8e8;
    
    .btns {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      
      .btn {
        padding: 8px 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        &.generate {
          min-width: 100px;
        }
      }
    }
  }
}
</style>
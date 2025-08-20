<template>
  <div class="ai-image-generator">
    <div class="prompt-input">
      <Input 
        v-model:value="prompt" 
        placeholder="请输入图片描述，例如：一只可爱的小猫在花园里玩耍"
        :maxlength="200"
        @keyup.enter="generateImage"
      />
      <div class="char-count">{{ prompt.length }}/200</div>
    </div>

    <div class="model-select">
      <div class="label">选择模型：</div>
      <div class="models">
        <div 
          v-for="model in models" 
          :key="model.value"
          class="model-item"
          :class="{ active: selectedModel === model.value }"
          @click="selectedModel = model.value"
        >
          {{ model.label }}
        </div>
      </div>
    </div>

    <div class="btns">
      <Button @click="emit('close')" style="margin-right: 10px;">取消</Button>
      <Button 
        type="primary" 
        :loading="isGenerating"
        :disabled="!prompt.trim()"
        @click="generateImage"
      >
        {{ isGenerating ? '生成中...' : '生成图片' }}
      </Button>
    </div>

    <div v-if="generatedImages.length > 0" class="generated-images">
      <div class="section-title">生成的图片：</div>
      <div class="image-grid">
        <div 
          v-for="(image, index) in generatedImages" 
          :key="index"
          class="image-item"
          @click="selectImage(image)"
        >
          <img :src="image" alt="生成的图片" />
          <div class="image-overlay">
            <IconCheck class="check-icon" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import message from '@/utils/message'
import { aiImageService } from '@/services/aiImageService'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'

const emit = defineEmits<{
  (event: 'insertImage', payload: string): void
  (event: 'close'): void
}>()

const prompt = ref('')
const selectedModel = ref('jimeng')
const isGenerating = ref(false)
const generatedImages = ref<string[]>([])

const models = [
  { label: '即梦', value: 'jimeng' },
  { label: 'DALL-E', value: 'dalle', disabled: true },
  { label: 'Midjourney', value: 'midjourney', disabled: true },
]

const generateImage = async () => {
  if (!prompt.value.trim()) {
    message.error('请输入图片描述')
    return
  }

  isGenerating.value = true
  const loadingMessage = message.success('正在生成图片，请稍候...', { duration: 0 })

  try {
    const result = await aiImageService.generateImage({
      prompt: prompt.value,
      model: selectedModel.value
    })
    
    if (result.success && result.imageUrl) {
      generatedImages.value.unshift(result.imageUrl)
      message.success('图片生成成功！')
    }
    else {
      throw new Error(result.error || '图片生成失败')
    }
    
  }
  catch (error: any) {
    console.error('图片生成失败:', error)
    message.error(error.message || '图片生成失败，请稍后重试')
  }
  finally {
    loadingMessage.close()
    isGenerating.value = false
  }
}

const selectImage = (imageUrl: string) => {
  emit('insertImage', imageUrl)
}
</script>

<style lang="scss" scoped>
.ai-image-generator {
  width: 480px;
}

.prompt-input {
  position: relative;
  margin-bottom: 15px;

  .char-count {
    position: absolute;
    right: 8px;
    bottom: 8px;
    font-size: 12px;
    color: #999;
  }
}

.model-select {
  margin-bottom: 15px;

  .label {
    font-size: 14px;
    color: #333;
    margin-bottom: 8px;
  }

  .models {
    display: flex;
    gap: 8px;
  }

  .model-item {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;

    &:hover {
      border-color: $themeColor;
    }

    &.active {
      background-color: $themeColor;
      color: white;
      border-color: $themeColor;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.btns {
  text-align: right;
  margin-bottom: 20px;
}

.generated-images {
  .section-title {
    font-size: 14px;
    color: #333;
    margin-bottom: 10px;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;

    &:hover {
      border-color: $themeColor;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transition: opacity 0.2s;

      .check-icon {
        color: white;
        font-size: 24px;
      }
    }

    &:hover .image-overlay {
      opacity: 1;
    }
  }
}
</style>
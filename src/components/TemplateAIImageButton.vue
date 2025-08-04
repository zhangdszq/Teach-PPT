<template>
  <div class="template-ai-image-button">
    <button 
      @click="handleProcessImages"
      :disabled="isProcessing || !hasImages"
      class="process-button"
    >
      <span v-if="isProcessing">
        正在生成图片 {{ processedCount }}/{{ totalCount }}...
      </span>
      <span v-else-if="hasImages">
        生成AI图片 ({{ imageCount }}个)
      </span>
      <span v-else>
        无需生成的图片
      </span>
    </button>
    
    <div v-if="hasImages" class="image-info">
      <p>检测到 {{ imageCount }} 个具有描述的图片元素</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import useTemplateAIImage from '@/hooks/useTemplateAIImage'

const {
  isProcessing,
  processedCount,
  totalCount,
  processTemplateImages,
  hasTemplateImages,
  getTemplateImageCount,
} = useTemplateAIImage()

const hasImages = computed(() => hasTemplateImages())
const imageCount = computed(() => getTemplateImageCount())

const handleProcessImages = async () => {
  await processTemplateImages()
}
</script>

<style lang="scss" scoped>
.template-ai-image-button {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
  
  .process-button {
    width: 100%;
    padding: 12px 16px;
    background: #1890ff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
    
    &:hover:not(:disabled) {
      background: #40a9ff;
    }
    
    &:disabled {
      background: #d9d9d9;
      cursor: not-allowed;
    }
  }
  
  .image-info {
    margin-top: 12px;
    
    p {
      margin: 0;
      font-size: 12px;
      color: #666;
    }
  }
}
</style>
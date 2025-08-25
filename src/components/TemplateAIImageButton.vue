<template>
  <div class="template-ai-image-button">
    <div class="button-group">
      <button 
        @click="handleProcessCurrentSlideImages"
        :disabled="isProcessing || !hasCurrentSlideImages"
        class="process-button primary"
      >
        <span v-if="isProcessing">
          正在生成图片 {{ processedImageCount }}/{{ totalImageCount }}...
        </span>
        <span v-else-if="hasCurrentSlideImages">
          生成当前幻灯片图片 ({{ currentSlideImageCount }}个)
        </span>
        <span v-else>
          当前幻灯片无需生成图片
        </span>
      </button>
      
      <button 
        @click="handleProcessAllImages"
        :disabled="isProcessing || !hasAllImages"
        class="process-button secondary"
      >
        <span v-if="isProcessing">
          正在处理...
        </span>
        <span v-else-if="hasAllImages">
          生成所有幻灯片图片 ({{ allImageCount }}个)
        </span>
        <span v-else>
          无需生成的图片
        </span>
      </button>
    </div>
    
    <div v-if="hasCurrentSlideImages || hasAllImages" class="image-info">
      <p v-if="hasCurrentSlideImages">
        当前幻灯片检测到 {{ currentSlideImageCount }} 个具有描述的图片元素
      </p>
      <p v-if="hasAllImages">
        所有幻灯片共检测到 {{ allImageCount }} 个具有描述的图片元素
      </p>
      <div class="tip">
        <p>💡 建议优先使用"生成当前幻灯片图片"以节省性能和时间</p>
        <p>🚀 图片生成采用队列处理，每次并发2个请求，避免服务器压力过大</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import useAIImageGeneration from '@/hooks/useAIImageGeneration'

const {
  isGeneratingImages,
  processedImageCount,
  totalImageCount,
  processTemplateImages,
  processAllTemplateImages,
  hasTemplateImages,
  getTemplateImageCount,
  getAllTemplateImageCount
} = useAIImageGeneration()

// 为了简化模板中的使用
const isProcessing = isGeneratingImages


const hasCurrentSlideImages = computed(() => hasTemplateImages())
const currentSlideImageCount = computed(() => getTemplateImageCount())
const hasAllImages = computed(() => getAllTemplateImageCount() > 0)
const allImageCount = computed(() => getAllTemplateImageCount())

const handleProcessCurrentSlideImages = async () => {
  await processTemplateImages()
}

const handleProcessAllImages = async () => {
  await processAllTemplateImages()
}
</script>

<style lang="scss" scoped>
.template-ai-image-button {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
  
  .button-group {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    
    .process-button {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
      
      &.primary {
        background: #1890ff;
        color: white;
        
        &:hover:not(:disabled) {
          background: #40a9ff;
        }
      }
      
      &.secondary {
        background: #52c41a;
        color: white;
        
        &:hover:not(:disabled) {
          background: #73d13d;
        }
      }
      
      &:disabled {
        background: #d9d9d9;
        cursor: not-allowed;
        color: #999;
      }
    }
  }
  
  .image-info {
    .tip {
      margin-top: 8px;
      padding: 8px 12px;
      background: #e6f7ff;
      border: 1px solid #91d5ff;
      border-radius: 4px;
      
      p {
        margin: 0;
        font-size: 12px;
        color: #1890ff;
      }
    }
    
    p {
      margin: 4px 0;
      font-size: 12px;
      color: #666;
    }
  }
}
</style>
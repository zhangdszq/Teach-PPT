<template>
  <div class="template-select-dialog" v-if="visible">
    <div class="dialog-overlay" @click="handleClose"></div>
    <div class="dialog-content">
      <!-- 头部 -->
      <div class="header">
        <div class="title-section">
          <h1 class="title">选择课件模板</h1>
          <p class="subtitle">为教研老师精心准备的课件模板库，快速创建专业的教学课件</p>
        </div>
        <button class="close-btn" @click="handleClose">
          <IconClose />
        </button>
      </div>


      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在获取匹配的模板...</p>
      </div>

      <!-- 模板网格 -->
      <div class="template-grid" v-else>
        <!-- 空状态 -->
        <div v-if="matchedTemplates.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>暂无匹配的模板</h3>
          <p>当前内容没有找到匹配的模板，请尝试调整内容后重新匹配</p>
        </div>
        
        <!-- 模板列表 -->
        <div 
          v-for="template in matchedTemplates" 
          :key="template.id"
          :class="['template-card', { selected: selectedTemplate === template.id }]"
          @click="selectTemplate(template)"
        >
          <div class="template-preview">
            <img :src="template.cover" :alt="template.name" />
            <div class="preview-overlay">
              <button class="preview-btn" @click.stop="previewTemplate(template)">
                <IconPreviewOpen />
                预览
              </button>
            </div>
            <!-- 显示匹配分数 -->
            <div v-if="template.matchScore" class="match-score">
              匹配度: {{ template.matchScore.toFixed(1) }}%
            </div>
          </div>
          
          <div class="template-info">
            <h3 class="template-name">{{ template.name }}</h3>
            <p class="template-description">{{ template.description }}</p>
            
            <div class="template-meta">
              <div class="meta-item">
                <IconBook class="meta-icon" />
                <span>{{ template.subject }}</span>
              </div>
              <div class="meta-item">
                <IconUser class="meta-icon" />
                <span>{{ template.grade }}</span>
              </div>
              <div class="meta-item">
                <IconUser class="meta-icon" />
                <span>{{ template.author }}</span>
              </div>
            </div>
            
            <div class="template-tags">
              <span 
                v-for="tag in template.tags" 
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
            
            <div class="template-stats">
              <div class="stat-item">
                <IconCheckOne class="stat-icon" />
                <span>{{ template.likes || 0 }}</span>
              </div>
              <div class="stat-item">
                <IconDownload class="stat-icon" />
                <span>{{ template.downloads || 0 }}</span>
              </div>
              <div class="stat-item">
                <IconCheckOne class="stat-icon" />
                <span>{{ template.rating || 5.0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="footer">
        <div class="selected-info">
          <template v-if="selectedTemplateData">
            <img :src="selectedTemplateData.cover" class="selected-preview" />
            <div class="selected-details">
              <h4>{{ selectedTemplateData.name }}</h4>
              <p>{{ selectedTemplateData.description }}</p>
              <p v-if="selectedTemplateData.matchScore" class="match-info">
                匹配度: {{ selectedTemplateData.matchScore.toFixed(1) }}%
              </p>
            </div>
          </template>
          <div v-else class="no-selection">
            请选择一个模板
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="btn btn-secondary" @click="handleClose">
            取消
          </button>
          <button 
            class="btn btn-primary" 
            :disabled="!selectedTemplate"
            @click="handleConfirm"
          >
            使用此模板
          </button>
        </div>
      </div>
    </div>

    <!-- 预览模态框 -->
    <div v-if="previewVisible" class="preview-modal" @click="closePreview">
      <div class="preview-content" @click.stop>
        <button class="preview-close" @click="closePreview">
          <IconClose />
        </button>
        <img :src="previewTemplateData?.cover" :alt="previewTemplateData?.name" />
        <div class="preview-info">
          <h3>{{ previewTemplateData?.name }}</h3>
          <p>{{ previewTemplateData?.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import api from '@/services'
import message from '@/utils/message'

interface Template {
  id: string
  name: string
  description: string
  cover: string
  subject: string
  grade: string
  tags: string[]
  likes?: number
  downloads?: number
  rating?: number
  author?: string
  createdAt?: string
  matchScore?: number // 匹配分数
}

interface Props {
  visible: boolean
  aiData?: any // 当前幻灯片的AI数据，用于模板匹配
}

interface Emits {
  (e: 'close'): void
  (e: 'select', template: Template): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const slideStore = useSlidesStore()
const { templates: originalTemplates } = storeToRefs(slideStore)

// 状态管理
const selectedTemplate = ref<string>('')
const selectedTemplateData = ref<Template | null>(null)

// 预览状态
const previewVisible = ref(false)
const previewTemplateData = ref<Template | null>(null)

// 加载状态和匹配模板
const loading = ref(false)
const matchedTemplates = ref<Template[]>([])

// 从 match 接口获取模板数据
const fetchMatchedTemplates = async () => {
  if (!props.aiData) {
    console.warn('没有AI数据，使用默认模板')
    return
  }

  try {
    loading.value = true
    const response = await api.matchTemplate(props.aiData)
    const data = await response.json()
    
    console.log('Match API 返回数据:', data)
    
    // 修正数据结构判断：接口返回的是 status: "success" 而不是 success: true
    if (data.status === 'success' && data.data && data.data.length > 0) {
      // 按分数匹配结果降序排列
      const sortedResults = data.data.sort((a: any, b: any) => b.score - a.score)
      
      // 将匹配结果转换为模板格式
      matchedTemplates.value = sortedResults.map((result: any, index: number) => ({
        id: result.template.templateId || result.template.id || `template_${index}`,
        name: result.template.name || `模板 ${index + 1}`,
        description: result.template.description || `AI推荐模板，匹配分数：${result.score.toFixed(2)}`,
        cover: result.template.cover || result.template.thumbnail || 'https://via.placeholder.com/320x180?text=Template',
        subject: result.template.subject || 'english',
        grade: result.template.gradeLevel || result.template.grade || 'elementary',
        tags: result.template.tags || [result.template.templateCategory || 'AI匹配'],
        likes: Math.floor(Math.random() * 200) + 50,
        downloads: Math.floor(Math.random() * 500) + 100,
        rating: Math.min(5.0, 4.0 + result.score / 100), // 根据匹配分数计算评分
        author: result.template.author || 'AI推荐',
        createdAt: result.template.createdAt || new Date().toISOString().split('T')[0],
        matchScore: result.score // 保存匹配分数
      }))
      
      console.log('获取到匹配模板:', matchedTemplates.value)
    }
    else {
      console.log('未找到匹配的模板或数据格式不正确:', data)
      message.warning('未找到匹配的模板，使用默认模板')
      matchedTemplates.value = []
    }
  }
  catch (error) {
    console.error('获取匹配模板失败:', error)
    message.error('获取模板失败，使用默认模板')
    matchedTemplates.value = []
  }
  finally {
    loading.value = false
  }
}


// 选择模板
const selectTemplate = (template: Template) => {
  selectedTemplate.value = template.id
  selectedTemplateData.value = template
}

// 预览模板
const previewTemplate = (template: Template) => {
  previewTemplateData.value = template
  previewVisible.value = true
}

// 关闭预览
const closePreview = () => {
  previewVisible.value = false
  previewTemplateData.value = null
}

// 关闭对话框
const handleClose = () => {
  emit('close')
}

// 确认选择
const handleConfirm = () => {
  if (selectedTemplateData.value) {
    emit('select', selectedTemplateData.value)
  }
}

// 监听对话框显示状态，当打开时获取匹配模板
const { visible } = toRefs(props)
watch(visible, (newVisible) => {
  if (newVisible) {
    // 重置状态
    selectedTemplate.value = ''
    selectedTemplateData.value = null
    
    // 获取匹配模板
    fetchMatchedTemplates()
  }
})
</script>

<style lang="scss" scoped>
.template-select-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;

  .dialog-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .dialog-content {
    position: relative;
    width: 95vw;
    height: 90vh;
    max-width: 1400px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 32px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  .title-section {
    .title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }

    .subtitle {
      font-size: 16px;
      margin: 0;
      opacity: 0.9;
    }
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}


.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
}

.template-grid {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #6b7280;

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    h3 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #374151;
    }

    p {
      font-size: 16px;
      margin: 0;
      max-width: 400px;
      line-height: 1.5;
    }
  }

  .template-card {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;
    background: white;

    &:hover {
      border-color: #3b82f6;
      box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
      transform: translateY(-2px);
    }

    &.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .template-preview {
      position: relative;
      height: 180px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .match-score {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }

      .preview-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s;

        .preview-btn {
          background: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: transform 0.2s;

          &:hover {
            transform: scale(1.05);
          }
        }
      }

      &:hover .preview-overlay {
        opacity: 1;
      }
    }

    .template-info {
      padding: 16px;

      .template-name {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: #1f2937;
      }

      .template-description {
        font-size: 14px;
        color: #6b7280;
        margin: 0 0 12px 0;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .template-meta {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #6b7280;

          .meta-icon {
            font-size: 14px;
          }
        }
      }

      .template-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;

        .tag {
          background: #eff6ff;
          color: #1d4ed8;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
      }

      .template-stats {
        display: flex;
        justify-content: space-between;
        padding-top: 12px;
        border-top: 1px solid #f3f4f6;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #6b7280;

          .stat-icon {
            font-size: 14px;
          }
        }
      }
    }
  }
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;

  .selected-info {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;

    .selected-preview {
      width: 60px;
      height: 40px;
      object-fit: cover;
      border-radius: 6px;
    }

    .selected-details {
      h4 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 0 0 2px 0;
        font-size: 14px;
        color: #6b7280;
      }

      .match-info {
        color: #3b82f6;
        font-weight: 600;
      }
    }

    .no-selection {
      color: #9ca3af;
      font-style: italic;
    }
  }

  .action-buttons {
    display: flex;
    gap: 12px;

    .btn {
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &.btn-secondary {
        background: white;
        border: 1px solid #d1d5db;
        color: #374151;

        &:hover {
          background: #f9fafb;
        }
      }

      &.btn-primary {
        background: #3b82f6;
        border: 1px solid #3b82f6;
        color: white;

        &:hover:not(:disabled) {
          background: #2563eb;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }
}

.preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;

  .preview-content {
    position: relative;
    max-width: 80vw;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    overflow: hidden;

    .preview-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      z-index: 1;
    }

    img {
      width: 100%;
      height: auto;
      display: block;
    }

    .preview-info {
      padding: 20px;

      h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
      }

      p {
        margin: 0;
        color: #6b7280;
      }
    }
  }
}
</style>

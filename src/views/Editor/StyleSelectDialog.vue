<template>
  <div class="style-select-dialog" v-if="visible">
    <div class="dialog-overlay" @click="handleClose"></div>
    <div class="dialog-content">
      <!-- 头部 -->
      <div class="header">
        <div class="title-section">
          <h1 class="title">选择课件风格</h1>
          <p class="subtitle">为您的英语教学课件选择合适的视觉风格</p>
        </div>
        <button class="close-btn" @click="handleClose">
          <IconClose />
        </button>
      </div>

      <!-- 风格网格 -->
      <div class="style-grid">
        <div 
          v-for="styleItem in styleOptions" 
          :key="styleItem.id"
          :class="['style-card', { selected: selectedStyle === styleItem.id }]"
          @click="selectStyle(styleItem)"
        >
          <div class="style-preview">
            <div class="preview-image" :style="{ background: styleItem.gradient }">
              <div class="preview-content">
                <div class="preview-title">{{ styleItem.previewTitle }}</div>
                <div class="preview-text">{{ styleItem.previewText }}</div>
                <div class="preview-elements">
                  <div 
                    v-for="element in styleItem.previewElements" 
                    :key="element"
                    class="preview-element"
                    :style="{ background: styleItem.elementColor }"
                  >
                    {{ element }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="style-info">
            <h3 class="style-name">{{ styleItem.name }}</h3>
            <p class="style-description">{{ styleItem.description }}</p>
            
            <div class="style-features">
              <span 
                v-for="feature in styleItem.features" 
                :key="feature"
                class="feature-tag"
              >
                {{ feature }}
              </span>
            </div>
            
            <div class="style-meta">
              <div class="meta-item">
                <span class="meta-label">适用年级：</span>
                <span>{{ styleItem.suitableGrades.join('、') }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">教学场景：</span>
                <span>{{ styleItem.scenarios.join('、') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="footer">
        <div class="selected-info">
          <template v-if="selectedStyleData">
            <div class="selected-preview" :style="{ background: selectedStyleData.gradient }"></div>
            <div class="selected-details">
              <h4>{{ selectedStyleData.name }}</h4>
              <p>{{ selectedStyleData.description }}</p>
            </div>
          </template>
          <div v-else class="no-selection">
            请选择一个风格
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="btn btn-secondary" @click="handleClose">
            取消
          </button>
          <button 
            class="btn btn-primary" 
            :disabled="!selectedStyle"
            @click="handleConfirm"
          >
            使用此风格
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'

interface StyleOption {
  id: string
  name: string
  description: string
  gradient: string
  elementColor: string
  previewTitle: string
  previewText: string
  previewElements: string[]
  features: string[]
  suitableGrades: string[]
  scenarios: string[]
}

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'select', style: StyleOption): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedStyle = ref<string>('')
const selectedStyleData = ref<StyleOption | null>(null)

// 风格选项数据
const styleOptions = ref<StyleOption[]>([
  {
    id: 'children-friendly',
    name: '儿童友好',
    description: '温馨可爱的设计风格，使用柔和的色彩和圆润的形状，营造轻松愉快的学习氛围',
    gradient: 'linear-gradient(135deg, #FFB6C1, #87CEEB)',
    elementColor: '#FFE4E1',
    previewTitle: 'Letter A',
    previewText: 'Apple starts with A',
    previewElements: ['🍎', '✨', '🌈'],
    features: ['柔和色彩', '圆润设计', '可爱图标', '大字体'],
    suitableGrades: ['1-3年级', '启蒙阶段'],
    scenarios: ['字母学习', '单词认知', '基础发音']
  },
  {
    id: 'interactive-game',
    name: '互动游戏',
    description: '充满活力的游戏化设计，使用鲜艳的色彩和动感元素，激发学生的学习兴趣',
    gradient: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
    elementColor: '#FFE66D',
    previewTitle: 'Word Game',
    previewText: 'Find the missing letter!',
    previewElements: ['🎮', '⭐', '🏆'],
    features: ['鲜艳色彩', '动感设计', '游戏元素', '互动按钮'],
    suitableGrades: ['2-6年级', '小学全段'],
    scenarios: ['词汇游戏', '语法练习', '口语互动']
  },
  {
    id: 'cartoon-cute',
    name: '卡通可爱',
    description: '卡通风格的设计，使用明亮的色彩和有趣的卡通元素，让学习变得更有趣',
    gradient: 'linear-gradient(135deg, #A8E6CF, #FFD93D)',
    elementColor: '#FFAAA5',
    previewTitle: 'Happy Learning',
    previewText: 'Let\'s learn together!',
    previewElements: ['😊', '🎨', '📚'],
    features: ['卡通插图', '明亮色彩', '趣味元素', '友好界面'],
    suitableGrades: ['1-4年级', '低年级'],
    scenarios: ['故事教学', '情景对话', '文化介绍']
  },
  {
    id: 'educational-professional',
    name: '教育专业',
    description: '专业的教育设计风格，使用经典的配色和清晰的布局，适合正式的教学环境',
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    elementColor: '#E8EAF6',
    previewTitle: 'English Grammar',
    previewText: 'Present Simple Tense',
    previewElements: ['📖', '✏️', '📊'],
    features: ['专业配色', '清晰布局', '经典设计', '易读字体'],
    suitableGrades: ['4-9年级', '中高年级'],
    scenarios: ['语法教学', '阅读理解', '写作指导']
  },
  {
    id: 'enlightening-guide',
    name: '启蒙引导',
    description: '温和的启蒙风格，使用自然的色彩和简洁的设计，帮助初学者建立学习信心',
    gradient: 'linear-gradient(135deg, #74b9ff, #0984e3)',
    elementColor: '#DDA0DD',
    previewTitle: 'First Steps',
    previewText: 'Welcome to English!',
    previewElements: ['🌱', '🌟', '👶'],
    features: ['自然色彩', '简洁设计', '渐进引导', '温和过渡'],
    suitableGrades: ['启蒙-2年级', '初学者'],
    scenarios: ['入门教学', '基础认知', '兴趣培养']
  },
  {
    id: 'modern-minimalist',
    name: '现代简约',
    description: '现代简约的设计风格，使用简洁的线条和舒适的配色，营造专注的学习环境',
    gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
    elementColor: '#F0F8FF',
    previewTitle: 'Clean Design',
    previewText: 'Focus on learning',
    previewElements: ['▪', '▫', '●'],
    features: ['简约设计', '现代配色', '清晰层次', '专注体验'],
    suitableGrades: ['5-12年级', '中学阶段'],
    scenarios: ['高级语法', '文学阅读', '考试准备']
  }
])

// 选择风格
const selectStyle = (style: StyleOption) => {
  selectedStyle.value = style.id
  selectedStyleData.value = style
}

// 关闭对话框
const handleClose = () => {
  selectedStyle.value = ''
  selectedStyleData.value = null
  emit('close')
}

// 确认选择
const handleConfirm = () => {
  if (selectedStyleData.value) {
    emit('select', selectedStyleData.value)
  }
}
</script>

<style lang="scss" scoped>
.style-select-dialog {
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
    max-width: 1200px;
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

.style-grid {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;

  .style-card {
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

    .style-preview {
      height: 160px;
      overflow: hidden;

      .preview-image {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;

        .preview-content {
          text-align: center;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);

          .preview-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
          }

          .preview-text {
            font-size: 16px;
            margin-bottom: 12px;
          }

          .preview-elements {
            display: flex;
            justify-content: center;
            gap: 8px;

            .preview-element {
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 500;
              color: #333;
            }
          }
        }
      }
    }

    .style-info {
      padding: 20px;

      .style-name {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: #1f2937;
      }

      .style-description {
        font-size: 14px;
        color: #6b7280;
        margin: 0 0 16px 0;
        line-height: 1.5;
      }

      .style-features {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 16px;

        .feature-tag {
          background: #eff6ff;
          color: #1d4ed8;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
      }

      .style-meta {
        .meta-item {
          display: flex;
          margin-bottom: 8px;
          font-size: 13px;

          .meta-label {
            font-weight: 600;
            color: #374151;
            min-width: 80px;
          }

          span:last-child {
            color: #6b7280;
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
      border-radius: 6px;
    }

    .selected-details {
      h4 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
      border: none;

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
</style>
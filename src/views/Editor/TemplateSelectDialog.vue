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

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-group">
          <label class="filter-label">教学类型：</label>
          <div class="filter-buttons">
            <button 
              v-for="subject in subjects" 
              :key="subject.value"
              :class="['filter-btn', { active: selectedSubject === subject.value }]"
              @click="selectedSubject = subject.value"
            >
              {{ subject.label }}
            </button>
          </div>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">适用水平：</label>
          <div class="filter-buttons">
            <button 
              v-for="grade in grades" 
              :key="grade.value"
              :class="['filter-btn', { active: selectedGrade === grade.value }]"
              @click="selectedGrade = grade.value"
            >
              {{ grade.label }}
            </button>
          </div>
        </div>

        <div class="search-group">
          <input 
            v-model="searchKeyword"
            class="search-input"
            placeholder="搜索模板名称或标签..."
          />
          <IconSearch class="search-icon" />
        </div>
      </div>

      <!-- 模板网格 -->
      <div class="template-grid">
        <div 
          v-for="template in filteredTemplates" 
          :key="template.id"
          :class="['template-card', { selected: selectedTemplate === template.id }]"
          @click="selectTemplate(template)"
        >
          <div class="template-preview">
            <img :src="template.cover" :alt="template.name" />
            <div class="preview-overlay">
              <button class="preview-btn" @click.stop="previewTemplate(template)">
                <IconEye />
                预览
              </button>
            </div>
          </div>
          
          <div class="template-info">
            <h3 class="template-name">{{ template.name }}</h3>
            <p class="template-description">{{ template.description }}</p>
            
            <div class="template-meta">
              <div class="meta-item">
                <IconBook class="meta-icon" />
                <span>{{ getSubjectLabel(template.subject) }}</span>
              </div>
              <div class="meta-item">
                <IconGraduationCap class="meta-icon" />
                <span>{{ getGradeLabel(template.grade) }}</span>
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
                <IconHeart class="stat-icon" />
                <span>{{ template.likes || 0 }}</span>
              </div>
              <div class="stat-item">
                <IconDownload class="stat-icon" />
                <span>{{ template.downloads || 0 }}</span>
              </div>
              <div class="stat-item">
                <IconStar class="stat-icon" />
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
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'

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
}

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'select', template: Template): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const slideStore = useSlidesStore()
const { templates: originalTemplates } = storeToRefs(slideStore)

// 筛选状态
const selectedSubject = ref('all')
const selectedGrade = ref('all')
const searchKeyword = ref('')
const selectedTemplate = ref<string>('')
const selectedTemplateData = ref<Template | null>(null)

// 预览状态
const previewVisible = ref(false)
const previewTemplateData = ref<Template | null>(null)

// 英语教学分类选项
const subjects = [
  { value: 'all', label: '全部类型' },
  { value: 'phonics', label: '自然拼读' },
  { value: 'vocabulary', label: '词汇教学' },
  { value: 'grammar', label: '语法教学' },
  { value: 'reading', label: '阅读理解' },
  { value: 'listening', label: '听力训练' },
  { value: 'speaking', label: '口语练习' },
  { value: 'writing', label: '写作指导' },
  { value: 'story', label: '故事教学' },
  { value: 'song', label: '歌曲童谣' },
  { value: 'game', label: '游戏互动' }
]

// 英语水平分类选项
const grades = [
  { value: 'all', label: '全部水平' },
  { value: 'starter', label: '启蒙阶段' },
  { value: 'beginner', label: '初级水平' },
  { value: 'elementary', label: '基础水平' },
  { value: 'intermediate', label: '中级水平' },
  { value: 'advanced', label: '高级水平' },
  { value: 'grade1-2', label: '1-2年级' },
  { value: 'grade3-4', label: '3-4年级' },
  { value: 'grade5-6', label: '5-6年级' },
  { value: 'grade7-8', label: '7-8年级' },
  { value: 'grade9-12', label: '9-12年级' }
]

// 英语教学专用模板数据
const templates = ref<Template[]>([
  {
    id: 'template_1',
    name: '字母认知启蒙',
    description: '专为英语字母启蒙设计，包含字母形状、发音、书写练习，适合初学者',
    cover: 'https://asset.pptist.cn/img/template_1.jpg',
    subject: 'phonics',
    grade: 'starter',
    tags: ['字母认知', '发音练习', '书写训练'],
    likes: 245,
    downloads: 678,
    rating: 4.9,
    author: '李老师',
    createdAt: '2024-01-15'
  },
  {
    id: 'template_2',
    name: '自然拼读基础',
    description: '系统化的自然拼读教学，包含字母组合、发音规律、拼读练习',
    cover: 'https://asset.pptist.cn/img/template_2.jpg',
    subject: 'phonics',
    grade: 'beginner',
    tags: ['自然拼读', '发音规律', '拼读练习'],
    likes: 189,
    downloads: 432,
    rating: 4.8,
    author: '王老师',
    createdAt: '2024-01-20'
  },
  {
    id: 'template_3',
    name: '词汇卡片教学',
    description: '互动式词汇学习卡片，包含单词图片、音标、例句、记忆技巧',
    cover: 'https://asset.pptist.cn/img/template_3.jpg',
    subject: 'vocabulary',
    grade: 'elementary',
    tags: ['词汇卡片', '图片记忆', '例句练习'],
    likes: 312,
    downloads: 789,
    rating: 4.7,
    author: '张老师',
    createdAt: '2024-01-25'
  },
  {
    id: 'template_4',
    name: '语法点精讲',
    description: '清晰的语法知识点讲解，包含规则说明、例句对比、练习巩固',
    cover: 'https://asset.pptist.cn/img/template_4.jpg',
    subject: 'grammar',
    grade: 'intermediate',
    tags: ['语法精讲', '规则说明', '对比练习'],
    likes: 156,
    downloads: 345,
    rating: 4.6,
    author: '陈老师',
    createdAt: '2024-02-01'
  },
  {
    id: 'template_5',
    name: '绘本故事教学',
    description: '生动的英语绘本故事课件，包含故事情节、角色介绍、互动问答',
    cover: 'https://asset.pptist.cn/img/template_1.jpg',
    subject: 'story',
    grade: 'grade1-2',
    tags: ['绘本故事', '角色扮演', '互动问答'],
    likes: 278,
    downloads: 567,
    rating: 4.8,
    author: '刘老师',
    createdAt: '2024-02-05'
  },
  {
    id: 'template_6',
    name: '听力训练专题',
    description: '系统的听力技能训练，包含听力材料、题型练习、技巧指导',
    cover: 'https://asset.pptist.cn/img/template_2.jpg',
    subject: 'listening',
    grade: 'grade5-6',
    tags: ['听力训练', '题型练习', '技巧指导'],
    likes: 134,
    downloads: 298,
    rating: 4.5,
    author: '赵老师',
    createdAt: '2024-02-10'
  },
  {
    id: 'template_7',
    name: '口语对话练习',
    description: '实用的口语对话场景，包含日常对话、角色扮演、发音纠正',
    cover: 'https://asset.pptist.cn/img/template_3.jpg',
    subject: 'speaking',
    grade: 'grade3-4',
    tags: ['口语对话', '场景练习', '发音纠正'],
    likes: 201,
    downloads: 456,
    rating: 4.7,
    author: '孙老师',
    createdAt: '2024-02-15'
  },
  {
    id: 'template_8',
    name: '写作指导课件',
    description: '英语写作技能培养，包含写作结构、句型模板、范文分析',
    cover: 'https://asset.pptist.cn/img/template_4.jpg',
    subject: 'writing',
    grade: 'grade7-8',
    tags: ['写作指导', '句型模板', '范文分析'],
    likes: 167,
    downloads: 378,
    rating: 4.6,
    author: '周老师',
    createdAt: '2024-02-20'
  },
  {
    id: 'template_9',
    name: '英语歌曲教学',
    description: '寓教于乐的英语歌曲课件，包含歌词学习、节拍练习、文化背景',
    cover: 'https://asset.pptist.cn/img/template_1.jpg',
    subject: 'song',
    grade: 'starter',
    tags: ['英语歌曲', '节拍练习', '文化背景'],
    likes: 289,
    downloads: 623,
    rating: 4.9,
    author: '吴老师',
    createdAt: '2024-02-25'
  },
  {
    id: 'template_10',
    name: '课堂游戏互动',
    description: '丰富的英语课堂游戏，包含单词游戏、语法竞赛、团队合作',
    cover: 'https://asset.pptist.cn/img/template_2.jpg',
    subject: 'game',
    grade: 'elementary',
    tags: ['课堂游戏', '语法竞赛', '团队合作'],
    likes: 356,
    downloads: 712,
    rating: 4.8,
    author: '郑老师',
    createdAt: '2024-03-01'
  }
])

// 筛选后的模板
const filteredTemplates = computed(() => {
  let result = templates.value

  // 学科筛选
  if (selectedSubject.value !== 'all') {
    result = result.filter(t => t.subject === selectedSubject.value)
  }

  // 年级筛选
  if (selectedGrade.value !== 'all') {
    result = result.filter(t => t.grade === selectedGrade.value)
  }

  // 关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(t => 
      t.name.toLowerCase().includes(keyword) ||
      t.description.toLowerCase().includes(keyword) ||
      t.tags.some(tag => tag.toLowerCase().includes(keyword))
    )
  }

  return result
})

// 获取学科标签
const getSubjectLabel = (subject: string) => {
  return subjects.find(s => s.value === subject)?.label || subject
}

// 获取年级标签
const getGradeLabel = (grade: string) => {
  return grades.find(g => g.value === grade)?.label || grade
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

// 初始化
onMounted(() => {
  // 如果有原始模板数据，可以在这里合并
  if (originalTemplates.value.length > 0) {
    // 将原始模板数据转换为新格式
    const convertedTemplates = originalTemplates.value.map(t => ({
      id: t.id,
      name: t.name,
      description: `${t.name}模板，适用于多种教学场景`,
      cover: t.cover,
      subject: 'english', // 默认英语
      grade: 'primary', // 默认小学
      tags: ['通用模板'],
      likes: Math.floor(Math.random() * 200) + 50,
      downloads: Math.floor(Math.random() * 500) + 100,
      rating: 4.5 + Math.random() * 0.5,
      author: '系统',
      createdAt: '2024-01-01'
    }))
    
    templates.value = [...templates.value, ...convertedTemplates]
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

.filter-bar {
  padding: 20px 32px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;

  .filter-group {
    display: flex;
    align-items: center;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .filter-label {
      font-weight: 600;
      color: #374151;
      margin-right: 16px;
      min-width: 80px;
    }

    .filter-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      .filter-btn {
        padding: 6px 16px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 20px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        &.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
      }
    }
  }

  .search-group {
    position: relative;
    max-width: 300px;

    .search-input {
      width: 100%;
      padding: 8px 40px 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
    }
  }
}

.template-grid {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;

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
        margin: 0;
        font-size: 14px;
        color: #6b7280;
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
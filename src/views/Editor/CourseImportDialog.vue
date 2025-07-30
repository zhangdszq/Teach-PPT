<template>
  <div class="course-import-dialog" v-if="visible">
    <div class="dialog-overlay" @click="handleClose"></div>
    <div class="dialog-content">
      <!-- 头部 -->
      <div class="header">
        <div class="title-section">
          <h1 class="title">📚 导入课程大纲</h1>
          <p class="subtitle">将您的课程大纲转换为专业的PPT课件</p>
        </div>
        <button class="close-btn" @click="handleClose">
          <IconClose />
        </button>
      </div>

      <!-- 导入方式选择 -->
      <div class="import-methods">
        <div class="method-tabs">
          <button 
            :class="['tab-btn', { active: importMethod === 'paste' }]"
            @click="importMethod = 'paste'"
          >
            📝 粘贴文本
          </button>
          <button 
            :class="['tab-btn', { active: importMethod === 'file' }]"
            @click="importMethod = 'file'"
          >
            📁 上传文件
          </button>
          <button 
            :class="['tab-btn', { active: importMethod === 'template' }]"
            @click="importMethod = 'template'"
          >
            📋 使用模板
          </button>
        </div>

        <!-- 粘贴文本方式 -->
        <div v-if="importMethod === 'paste'" class="import-content">
          <div class="input-section">
            <label class="input-label">课程大纲内容：</label>
            <textarea 
              v-model="courseContent"
              class="course-textarea"
              placeholder="请粘贴您的课程大纲内容（支持Markdown格式）..."
              rows="12"
            ></textarea>
          </div>
        </div>

        <!-- 上传文件方式 -->
        <div v-if="importMethod === 'file'" class="import-content">
          <div class="file-upload">
            <input 
              type="file" 
              ref="fileInput"
              accept=".md,.txt"
              @change="handleFileUpload"
              style="display: none"
            />
            <div class="upload-area" @click="$refs.fileInput.click()">
              <div class="upload-icon">📄</div>
              <div class="upload-text">
                <p>点击选择文件或拖拽文件到此处</p>
                <p class="upload-hint">支持 .md 和 .txt 格式</p>
              </div>
            </div>
            <div v-if="uploadedFileName" class="uploaded-file">
              <IconFile />
              <span>{{ uploadedFileName }}</span>
              <button @click="clearFile" class="clear-btn">
                <IconClose />
              </button>
            </div>
          </div>
        </div>

        <!-- 使用模板方式 -->
        <div v-if="importMethod === 'template'" class="import-content">
          <div class="template-selection">
            <h3>选择课程模板：</h3>
            <div class="template-grid">
              <div 
                v-for="template in courseTemplates" 
                :key="template.id"
                :class="['template-card', { selected: selectedTemplate === template.id }]"
                @click="selectCourseTemplate(template)"
              >
                <div class="template-icon">{{ template.icon }}</div>
                <div class="template-info">
                  <h4>{{ template.name }}</h4>
                  <p>{{ template.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <div v-if="parsedCourse" class="preview-section">
        <h3 class="preview-title">📋 课程结构预览</h3>
        <div class="course-preview">
          <div class="course-info">
            <h4>{{ parsedCourse.title || '课程标题' }}</h4>
            <p v-if="parsedCourse.targetAge">适合年龄：{{ parsedCourse.targetAge }}</p>
            <div v-if="parsedCourse.objectives.length > 0" class="objectives">
              <strong>教学目标：</strong>
              <ul>
                <li v-for="(objective, index) in parsedCourse.objectives" :key="index">
                  {{ objective }}
                </li>
              </ul>
            </div>
          </div>
          
          <div class="lessons-preview">
            <h5>课程内容（{{ parsedCourse.lessons.length }} 页）：</h5>
            <div class="lesson-list">
              <div 
                v-for="(lesson, index) in parsedCourse.lessons" 
                :key="index"
                class="lesson-item"
              >
                <div class="lesson-type">
                  <span :class="['type-badge', lesson.type]">
                    {{ getTypeLabel(lesson.type) }}
                  </span>
                </div>
                <div class="lesson-title">{{ lesson.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="footer">
        <div class="generation-options">
          <label class="option-item">
            <input type="checkbox" v-model="options.includeAnimations" />
            <span>包含动画效果</span>
          </label>
          <label class="option-item">
            <input type="checkbox" v-model="options.autoGenerateImages" />
            <span>自动生成配图</span>
          </label>
          <label class="option-item">
            <input type="checkbox" v-model="options.addInteractiveElements" />
            <span>添加互动元素</span>
          </label>
        </div>
        
        <div class="action-buttons">
          <button class="btn btn-secondary" @click="handleClose">
            取消
          </button>
          <button 
            class="btn btn-primary" 
            :disabled="!canGenerate"
            @click="handleGenerate"
          >
            🚀 生成PPT
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { CourseOutlineParser, PPTGenerator, type CourseStructure } from '@/utils/courseTemplateMapper'
import { useSlidesStore } from '@/store'
import message from '@/utils/message'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'generated', pptData: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const slidesStore = useSlidesStore()

// 导入方式
const importMethod = ref<'paste' | 'file' | 'template'>('paste')

// 课程内容
const courseContent = ref('')
const uploadedFileName = ref('')
const selectedTemplate = ref('')
const fileInput = ref<HTMLInputElement>()

// 解析后的课程结构
const parsedCourse = ref<CourseStructure | null>(null)

// 生成选项
const options = ref({
  includeAnimations: true,
  autoGenerateImages: true,
  addInteractiveElements: false
})

// 课程模板
const courseTemplates = [
  {
    id: 'phonics-abc',
    name: '字母拼读课程',
    description: '适合3-6岁儿童的字母认知和自然拼读',
    icon: '🔤',
    content: `
## 🧠 教学目标（适合3-6岁）
* 认识字母 A / B / C 的大写与小写
* 学会字母发音：/æ/、/b/、/k/
* 理解发音与单词之间的联系（自然拼读意识）

### 🌟 **Lesson 1: A a**
#### 📄 教学页面 1：字母形状
* 展示大写和小写：**A a**
* 指导语：**"This is A. Big A, small a."**

#### 🔊 教学页面 2：字母音
* 语音演示：**"A says /æ/, /æ/, /æ/."**

#### 🖼️ 教学页面 3：字母A开头单词
* 图卡：**A is for Apple, Ant, Alligator**
`
  },
  {
    id: 'vocabulary-theme',
    name: '主题词汇课程',
    description: '按主题分类的词汇教学课程',
    icon: '📚',
    content: `
## 🧠 教学目标
* 学习动物主题词汇
* 掌握基本句型表达
* 培养英语表达兴趣

### 🌟 **Lesson 1: Animals**
#### 📄 教学页面 1：动物认知
* 展示各种动物图片和单词

#### 🔊 教学页面 2：发音练习
* 动物单词发音训练
`
  },
  {
    id: 'story-based',
    name: '故事教学课程',
    description: '基于英语绘本故事的教学课程',
    icon: '📖',
    content: `
## 🧠 教学目标
* 理解故事情节
* 学习故事中的词汇
* 培养阅读兴趣

### 🌟 **Story: The Very Hungry Caterpillar**
#### 📄 教学页面 1：故事导入
* 介绍故事背景和主角

#### 📄 教学页面 2：故事阅读
* 分段阅读故事内容
`
  }
]

// 计算属性
const canGenerate = computed(() => {
  return parsedCourse.value && parsedCourse.value.lessons.length > 0
})

// 监听课程内容变化
watch(courseContent, (newContent) => {
  if (newContent.trim()) {
    try {
      parsedCourse.value = CourseOutlineParser.parseMarkdownOutline(newContent)
    } catch (error) {
      console.error('解析课程大纲失败:', error)
      parsedCourse.value = null
    }
  } else {
    parsedCourse.value = null
  }
}, { immediate: true })

// 获取类型标签
const getTypeLabel = (type: string) => {
  switch (type) {
    case 'lesson': return '教学'
    case 'practice': return '练习'
    case 'review': return '复习'
    default: return '其他'
  }
}

// 处理文件上传
const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    uploadedFileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      courseContent.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

// 清除文件
const clearFile = () => {
  uploadedFileName.value = ''
  courseContent.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 选择课程模板
const selectCourseTemplate = (template: any) => {
  selectedTemplate.value = template.id
  courseContent.value = template.content
}

// 关闭对话框
const handleClose = () => {
  emit('close')
}

// 生成PPT
const handleGenerate = async () => {
  if (!parsedCourse.value) {
    message.error('请先输入有效的课程大纲')
    return
  }

  try {
    const loadingMessage = message.info('正在生成PPT课件...', { duration: 0 })
    
    // 生成PPT数据
    const pptData = PPTGenerator.generatePPTFromCourse(parsedCourse.value)
    
    // 应用生成选项
    if (options.value.includeAnimations) {
      // 为幻灯片添加动画效果
      pptData.slides.forEach(slide => {
        slide.animations = [
          {
            id: `anim_${Date.now()}`,
            elId: slide.elements[0]?.id,
            type: 'fadeIn',
            duration: 1000
          }
        ]
      })
    }

    loadingMessage.close()
    
    // 更新幻灯片数据
    slidesStore.setSlides(pptData.slides)
    slidesStore.setTheme(pptData.theme)
    
    message.success('PPT生成成功！')
    emit('generated', pptData)
    emit('close')
    
  } catch (error) {
    console.error('生成PPT失败:', error)
    message.error('生成PPT失败，请检查课程大纲格式')
  }
}
</script>

<style lang="scss" scoped>
.course-import-dialog {
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
    width: 90vw;
    height: 85vh;
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
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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

.import-methods {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .method-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;

    .tab-btn {
      flex: 1;
      padding: 16px 24px;
      border: none;
      background: transparent;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border-bottom: 3px solid transparent;

      &:hover {
        background: #f3f4f6;
      }

      &.active {
        background: white;
        border-bottom-color: #10b981;
        color: #10b981;
      }
    }
  }

  .import-content {
    flex: 1;
    padding: 24px 32px;
    overflow-y: auto;

    .input-section {
      .input-label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
        color: #374151;
      }

      .course-textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        font-family: 'Consolas', 'Monaco', monospace;
        resize: vertical;

        &:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
      }
    }

    .file-upload {
      .upload-area {
        border: 2px dashed #d1d5db;
        border-radius: 12px;
        padding: 48px 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .upload-text {
          p {
            margin: 8px 0;
            font-size: 16px;
            color: #374151;
          }

          .upload-hint {
            font-size: 14px;
            color: #6b7280;
          }
        }
      }

      .uploaded-file {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        margin-top: 16px;

        .clear-btn {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;

          &:hover {
            background: #e5e7eb;
          }
        }
      }
    }

    .template-selection {
      h3 {
        margin: 0 0 20px 0;
        color: #374151;
      }

      .template-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;

        .template-card {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 16px;

          &:hover {
            border-color: #10b981;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
          }

          &.selected {
            border-color: #10b981;
            background: #f0fdf4;
          }

          .template-icon {
            font-size: 32px;
            flex-shrink: 0;
          }

          .template-info {
            h4 {
              margin: 0 0 8px 0;
              font-size: 18px;
              color: #1f2937;
            }

            p {
              margin: 0;
              font-size: 14px;
              color: #6b7280;
              line-height: 1.4;
            }
          }
        }
      }
    }
  }
}

.preview-section {
  border-top: 1px solid #e5e7eb;
  padding: 24px 32px;
  background: #f9fafb;
  max-height: 300px;
  overflow-y: auto;

  .preview-title {
    margin: 0 0 16px 0;
    color: #374151;
    font-size: 18px;
  }

  .course-preview {
    .course-info {
      margin-bottom: 20px;

      h4 {
        margin: 0 0 8px 0;
        font-size: 20px;
        color: #1f2937;
      }

      p {
        margin: 4px 0;
        color: #6b7280;
      }

      .objectives {
        margin-top: 12px;

        ul {
          margin: 8px 0 0 20px;
          
          li {
            margin: 4px 0;
            color: #374151;
          }
        }
      }
    }

    .lessons-preview {
      h5 {
        margin: 0 0 12px 0;
        color: #374151;
      }

      .lesson-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 8px;

        .lesson-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e5e7eb;

          .type-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;

            &.lesson {
              background: #dbeafe;
              color: #1d4ed8;
            }

            &.practice {
              background: #dcfce7;
              color: #166534;
            }

            &.review {
              background: #fef3c7;
              color: #92400e;
            }
          }

          .lesson-title {
            font-size: 14px;
            color: #374151;
            flex: 1;
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

  .generation-options {
    display: flex;
    gap: 24px;

    .option-item {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;

      input[type="checkbox"] {
        width: 16px;
        height: 16px;
      }
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
        background: #10b981;
        border: 1px solid #10b981;
        color: white;

        &:hover:not(:disabled) {
          background: #059669;
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
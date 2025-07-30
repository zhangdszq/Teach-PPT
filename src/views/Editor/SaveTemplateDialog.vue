<template>
  <Modal 
    v-model:visible="dialogVisible" 
    :width="480"
    :closable="false"
  >
    <div class="save-template-dialog">
      <div class="header">
        <div class="title">保存为模板</div>
        <div class="subtitle">将当前页面保存为模板，方便教研老师制作课件时使用</div>
      </div>
      
      <div class="form">
        <div class="form-item">
          <label class="label">模板名称 *</label>
          <input 
            v-model="templateForm.name"
            class="input"
            placeholder="请输入模板名称，如：英语单词卡片模板"
            maxlength="50"
          />
        </div>
        
        <div class="form-item">
          <label class="label">模板描述</label>
          <textarea 
            v-model="templateForm.description"
            class="textarea"
            placeholder="请描述模板的用途和特点，如：适用于英语单词教学，包含单词、音标、释义等元素"
            maxlength="200"
            rows="3"
          />
        </div>
        
        <div class="form-item">
          <label class="label">适用学科</label>
          <select v-model="templateForm.subject" class="select">
            <option value="">请选择学科</option>
            <option value="english">英语</option>
            <option value="chinese">语文</option>
            <option value="math">数学</option>
            <option value="science">科学</option>
            <option value="history">历史</option>
            <option value="geography">地理</option>
            <option value="other">其他</option>
          </select>
        </div>
        
        <div class="form-item">
          <label class="label">适用年级</label>
          <div class="checkbox-group">
            <label class="checkbox-item" v-for="grade in gradeOptions" :key="grade.value">
              <input 
                type="checkbox" 
                :value="grade.value"
                v-model="templateForm.grades"
              />
              <span>{{ grade.label }}</span>
            </label>
          </div>
        </div>
        
        <div class="form-item">
          <label class="label">模板标签</label>
          <div class="tag-input">
            <div class="tags">
              <span 
                v-for="(tag, index) in templateForm.tags" 
                :key="index"
                class="tag"
              >
                {{ tag }}
                <button @click="removeTag(index)" class="tag-remove">×</button>
              </span>
            </div>
            <input 
              v-model="newTag"
              @keyup.enter="addTag"
              class="tag-input-field"
              placeholder="输入标签后按回车添加"
              maxlength="10"
            />
          </div>
          <div class="tag-suggestions">
            <span 
              v-for="suggestion in tagSuggestions" 
              :key="suggestion"
              @click="addSuggestedTag(suggestion)"
              class="tag-suggestion"
            >
              {{ suggestion }}
            </span>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <button @click="handleCancel" class="btn btn-cancel">取消</button>
        <button 
          @click="handleSave" 
          :disabled="!templateForm.name.trim() || saving"
          class="btn btn-primary"
        >
          {{ saving ? '保存中...' : '保存模板' }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import api from '@/services'
import message from '@/utils/message'
import Modal from '@/components/Modal.vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = ref(false)
const saving = ref(false)
const newTag = ref('')

// 表单数据
const templateForm = reactive({
  name: '',
  description: '',
  subject: '',
  grades: [] as string[],
  tags: [] as string[]
})

// 年级选项
const gradeOptions = [
  { value: 'grade1', label: '一年级' },
  { value: 'grade2', label: '二年级' },
  { value: 'grade3', label: '三年级' },
  { value: 'grade4', label: '四年级' },
  { value: 'grade5', label: '五年级' },
  { value: 'grade6', label: '六年级' },
  { value: 'junior1', label: '初一' },
  { value: 'junior2', label: '初二' },
  { value: 'junior3', label: '初三' },
  { value: 'senior1', label: '高一' },
  { value: 'senior2', label: '高二' },
  { value: 'senior3', label: '高三' }
]

// 标签建议
const tagSuggestions = [
  '单词卡片', '语法练习', '阅读理解', '听力训练', '口语练习',
  '课文讲解', '知识点总结', '练习题', '复习资料', '互动游戏'
]

// 监听visible变化
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal
  if (newVal) {
    resetForm()
  }
})

watch(dialogVisible, (newVal) => {
  if (!newVal) {
    emit('close')
  }
})

// 重置表单
const resetForm = () => {
  templateForm.name = ''
  templateForm.description = ''
  templateForm.subject = ''
  templateForm.grades = []
  templateForm.tags = []
  newTag.value = ''
}

// 添加标签
const addTag = () => {
  const tag = newTag.value.trim()
  if (tag && !templateForm.tags.includes(tag) && templateForm.tags.length < 5) {
    templateForm.tags.push(tag)
    newTag.value = ''
  }
}

// 添加建议标签
const addSuggestedTag = (tag: string) => {
  if (!templateForm.tags.includes(tag) && templateForm.tags.length < 5) {
    templateForm.tags.push(tag)
  }
}

// 移除标签
const removeTag = (index: number) => {
  templateForm.tags.splice(index, 1)
}

// 取消保存
const handleCancel = () => {
  dialogVisible.value = false
}

// 保存模板
const handleSave = async () => {
  if (!templateForm.name.trim()) {
    message.error('请输入模板名称')
    return
  }

  try {
    saving.value = true
    
    // 获取当前页面数据
    const slidesStore = useSlidesStore()
    const { currentSlide, theme, viewportRatio, viewportSize } = storeToRefs(slidesStore)
    
    if (!currentSlide.value) {
      message.error('当前页面为空，无法保存为模板')
      return
    }

    // 构建模板数据
    const templateData = {
      title: templateForm.name,
      width: viewportSize.value,
      height: viewportSize.value * viewportRatio.value,
      theme: theme.value,
      slides: [currentSlide.value],
      // 模板元数据
      metadata: {
        name: templateForm.name,
        description: templateForm.description,
        subject: templateForm.subject,
        grades: templateForm.grades,
        tags: templateForm.tags,
        createdAt: new Date().toISOString(),
        author: '教师', // 可以从用户信息中获取
        version: '1.0'
      }
    }

    const response = await api.SaveTemplate({
      slideData: templateData,
      templateName: templateForm.name
    })

    const result = await response.json()
    
    if (result.status === 'success') {
      message.success(`模板"${templateForm.name}"保存成功！`)
      dialogVisible.value = false
    } else {
      message.error(result.error_message || '模板保存失败')
    }
    
  } catch (error) {
    console.error('保存模板失败:', error)
    message.error('模板保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.save-template-dialog {
  .header {
    margin-bottom: 24px;
    
    .title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }
  }
  
  .form {
    .form-item {
      margin-bottom: 20px;
      
      .label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 8px;
      }
      
      .input, .textarea, .select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
        
        &:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      }
      
      .textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .checkbox-group {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        
        .checkbox-item {
          display: flex;
          align-items: center;
          font-size: 14px;
          cursor: pointer;
          
          input[type="checkbox"] {
            margin-right: 6px;
          }
        }
      }
      
      .tag-input {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px;
        min-height: 40px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        
        &:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .tag {
          background: #eff6ff;
          color: #1d4ed8;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          
          .tag-remove {
            background: none;
            border: none;
            color: #1d4ed8;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            
            &:hover {
              color: #1e40af;
            }
          }
        }
        
        .tag-input-field {
          border: none;
          outline: none;
          flex: 1;
          min-width: 120px;
          font-size: 14px;
        }
      }
      
      .tag-suggestions {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        
        .tag-suggestion {
          background: #f3f4f6;
          color: #4b5563;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
          
          &:hover {
            background: #e5e7eb;
          }
        }
      }
    }
  }
  
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      
      &.btn-cancel {
        background: #f9fafb;
        border: 1px solid #d1d5db;
        color: #374151;
        
        &:hover {
          background: #f3f4f6;
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
</style>
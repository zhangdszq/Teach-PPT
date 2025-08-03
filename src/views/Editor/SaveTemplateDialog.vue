<template>
  <Modal 
    v-model:visible="dialogVisible" 
    :width="520"
    :closable="false"
  >
    <div class="save-template-dialog">
      <div class="header">
        <div class="title">保存为模板</div>
        <div class="subtitle">将当前页面保存为模板，方便其他老师快速复用</div>
      </div>
      
      <div class="form-content">
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
          <label class="label">模板类型 *</label>
          <select v-model="templateForm.templateType" class="select">
            <option disabled value="">请选择或使用AI智能提取</option>
            <option v-for="type in templateTypeOptions" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>
        
        <div class="form-item">
          <label class="label">模板描述</label>
          <textarea 
            v-model="templateForm.description"
            class="textarea"
            placeholder="请描述模板的用途和特点"
            maxlength="200"
            rows="3"
          />
        </div>
        
        <div class="form-item">
          <label class="label">课程类型</label>
          <select v-model="templateForm.courseType" class="select">
            <option value="">不指定课程类型</option>
            <option v-for="course in courseTypeOptions" :key="course" :value="course">{{ course }}</option>
          </select>
        </div>
        
        <div class="form-item">
          <label class="label">适用年级</label>
          <div class="checkbox-group">
            <label 
              class="checkbox-item" 
              v-for="grade in gradeOptions" 
              :key="grade.value"
              :class="{ 'checked': templateForm.grades.includes(grade.value) }"
            >
              <input 
                type="checkbox" 
                :value="grade.value"
                v-model="templateForm.grades"
                class="checkbox-input"
              />
              <span class="checkbox-label">{{ grade.label }}</span>
            </label>
          </div>
        </div>
        
        <div class="form-item">
          <label class="label">模板标签</label>
          <div class="tag-input-wrapper">
            <div class="tags">
              <span 
                v-for="(tag, index) in templateForm.tags" 
                :key="index"
                class="tag"
              >
                {{ tag }}
                <button @click="removeTag(index)" class="tag-remove">&times;</button>
              </span>
            </div>
            <input 
              v-model="newTag"
              @keyup.enter="addTag"
              class="tag-input-field"
              placeholder="输入后按回车添加(最多5个)"
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
              + {{ suggestion }}
            </span>
          </div>
        </div>

        <div class="ai-extract-section">
          <button 
            @click="handleAIExtract" 
            :disabled="aiExtracting"
            class="btn-ai-extract"
          >
            <span class="ai-icon">✨</span>
            {{ aiExtracting ? 'AI分析中...' : 'AI智能提取特征' }}
          </button>
          <div class="ai-extract-tip">
            使用AI分析当前页面，自动填写模板名称、类型、标签等信息
          </div>
        </div>
      </div>
      
      <div class="footer">
        <button @click="handleCancel" class="btn btn-cancel">取消</button>
        <button 
          @click="handleSave" 
          :disabled="!templateForm.name.trim() || !templateForm.templateType || saving"
          class="btn btn-primary"
        >
          {{ saving ? '保存中...' : '确认保存' }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import message from '@/utils/message'
import Modal from '@/components/Modal.vue'
import { courseTypeOptions } from '@/configs/course'

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
const aiExtracting = ref(false)
const aiExtractedFeatures = ref<any>(null) // 存储AI分析的完整数据

// 表单数据
const templateForm = reactive({
  name: '',
  templateType: '',
  description: '',
  courseType: '',
  grades: [] as string[],
  tags: [] as string[]
})

// 模板类型选项 - 从后端获取
const templateTypeOptions = ref<string[]>([])

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

// 获取模板类型选项
const fetchTemplateTypes = async () => {
  try {
    const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api/template/types' : '/api/template/types'
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const result = await response.json()
    
    if (result.status === 'success' && result.data && Array.isArray(result.data)) {
      templateTypeOptions.value = result.data
      console.log('✅ 模板类型选项获取成功:', result.data)
    } else {
      console.warn('⚠️ 模板类型选项获取失败，使用默认选项')
      // 使用默认选项作为备选
      templateTypeOptions.value = [
        "自我介绍",
        "学习目标", 
        "提问环节",
        "正式学习",
        "自由讨论",
        "看图选择"
      ]
    }
  } catch (error) {
    console.error('❌ 获取模板类型选项失败:', error)
    // 使用默认选项作为备选
    templateTypeOptions.value = [
      "自我介绍",
      "学习目标",
      "提问环节", 
      "正式学习",
      "自由讨论",
      "看图选择"
    ]
  }
}

// 组件挂载时获取模板类型选项
onMounted(() => {
  fetchTemplateTypes()
})

// 监听visible变化
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal
  if (newVal) {
    resetForm()
    // 每次打开对话框时重新获取模板类型选项
    fetchTemplateTypes()
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
  templateForm.templateType = ''
  templateForm.description = ''
  templateForm.courseType = ''
  templateForm.grades = []
  templateForm.tags = []
  newTag.value = ''
  saving.value = false
  aiExtracting.value = false
  aiExtractedFeatures.value = null // 重置AI数据
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

// 清理对象中的 base64 图片数据，并处理循环引用
const cleanBase64Images = (obj: any): any => {
  const visited = new WeakSet()

  const recurse = (current: any) => {
    if (!current || typeof current !== 'object') {
      return current
    }

    if (visited.has(current)) {
      return '[Circular Reference]'
    }
    visited.add(current)

    if (Array.isArray(current)) {
      return current.map(item => recurse(item))
    }

    const result: { [key: string]: any } = {}
    const imageProps = ['src', 'url', 'image', 'backgroundImage', 'thumbnail']

    for (const key in current) {
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        const value = current[key]
        if (imageProps.includes(key) && typeof value === 'string' && value.startsWith('data:image')) {
          result[key] = '[图片数据已清理]'
        } else {
          result[key] = recurse(value)
        }
      }
    }
    return result
  }

  return recurse(obj)
}

// AI 特征提取
const handleAIExtract = async () => {
  try {
    aiExtracting.value = true
    
    // 获取当前页面数据
    const slidesStore = useSlidesStore()
    const { currentSlide } = storeToRefs(slidesStore)
    
    if (!currentSlide.value) {
      message.error('当前页面为空，无法进行AI分析')
      return
    }

    // 生成页面截图
    const imageBase64 = await captureSlideImage()
    if (!imageBase64) {
      message.error('页面截图失败，请重试')
      return
    }

    // 清理 slideData 中的 base64 图片数据
    const cleanedSlideData = cleanBase64Images(JSON.parse(JSON.stringify(currentSlide.value)))
    console.log('🧹 已清理 slideData 中的 base64 图片数据')
    
    // 调用后端AI特征提取接口
    const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api/ai/extract-template-features' : '/api/ai/extract-template-features'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        slideData: cleanedSlideData
      })
    })

    const result = await response.json()
    
    if (result.status === 'success' && result.data && result.data.features) {
      const features = result.data.features
      
      // 存储AI分析的完整数据，用于后续保存
      aiExtractedFeatures.value = features
      
      // 自动填充模板名称
      if (features.templateName && !templateForm.name.trim()) {
        templateForm.name = features.templateName
      }
      
      // 自动填充模板类型
      if (features.templateType) {
        // 如果AI返回的类型不在现有选项中，则动态添加
        if (!templateTypeOptions.value.includes(features.templateType)) {
          templateTypeOptions.value.push(features.templateType)
        }
        templateForm.templateType = features.templateType
      }
      
      // 自动填充模板描述
      if (features.description && !templateForm.description.trim()) {
        templateForm.description = features.description
      }
      
      // 自动填充课程类型信息
      if (features.subject && !templateForm.courseType) {
        // 检查AI返回的课程类型是否存在于选项中
        if (courseTypeOptions.includes(features.subject)) {
          templateForm.courseType = features.subject
        }
      }
      
      // 处理年级信息
      if (features.grade && typeof features.grade === 'string') {
        // 解析年级字符串，如 "幼儿园、小学、初中、高中"
        const gradeText = features.grade
        const suggestedGrades: string[] = []
        
        if (gradeText.includes('小学') || gradeText.includes('一年级') || gradeText.includes('二年级') || 
            gradeText.includes('三年级') || gradeText.includes('四年级') || gradeText.includes('五年级') || 
            gradeText.includes('六年级')) {
          suggestedGrades.push('grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6')
        }
        
        if (gradeText.includes('初中') || gradeText.includes('初一') || gradeText.includes('初二') || gradeText.includes('初三')) {
          suggestedGrades.push('junior1', 'junior2', 'junior3')
        }
        
        if (gradeText.includes('高中') || gradeText.includes('高一') || gradeText.includes('高二') || gradeText.includes('高三')) {
          suggestedGrades.push('senior1', 'senior2', 'senior3')
        }
        
        if (suggestedGrades.length > 0) {
          templateForm.grades = [...new Set([...templateForm.grades, ...suggestedGrades])]
        }
      }
      
      // 自动填充标签
      if (features.tags && Array.isArray(features.tags) && features.tags.length > 0) {
        // 合并现有标签和AI提取的标签，去重并限制数量
        const allTags = [...new Set([...templateForm.tags, ...features.tags])]
        templateForm.tags = allTags.slice(0, 5)
      }
      
      // 显示成功消息，包含提取到的关键信息
      const extractedInfo = []
      if (features.templateName) extractedInfo.push(`模板名称: ${features.templateName}`)
      if (features.templateType) extractedInfo.push(`模板类型: ${features.templateType}`)
      if (features.subject) extractedInfo.push(`学科: ${features.subject}`)
      if (features.tags && features.tags.length > 0) extractedInfo.push(`标签: ${features.tags.join(', ')}`)
      
      message.success(`AI特征提取完成！已自动填充: ${extractedInfo.join(' | ')}`)

      // 将生成的图片添加到幻灯片中
      if (result.data.image_url) {
        const imageElement = {
          type: 'image',
          id: `el-${new Date().getTime()}`,
          src: result.data.image_url,
          width: 300,
          height: 300,
          left: 100,
          top: 100,
          rotate: 0,
          fixedRatio: false,
          color: '',
          loop: false,
          autoplay: false
        }
        slidesStore.addElement(imageElement)
        message.success('图片已成功添加到当前页面！')
      }
      
    } else {
      message.error(result.message || 'AI特征提取失败，请重试')
    }
    
  } catch (error) {
    console.error('AI特征提取失败:', error)
    message.error('AI特征提取失败，请检查网络连接后重试')
  } finally {
    aiExtracting.value = false
  }
}

// 压缩图片
const compressImage = (canvas: HTMLCanvasElement, maxWidth: number = 800, maxHeight: number = 600, quality: number = 0.6): string => {
  const { width, height } = canvas
  
  // 计算压缩比例
  let scale = 1
  if (width > maxWidth || height > maxHeight) {
    scale = Math.min(maxWidth / width, maxHeight / height)
  }
  
  const newWidth = Math.floor(width * scale)
  const newHeight = Math.floor(height * scale)
  
  console.log(`🔧 图片压缩: ${width}x${height} -> ${newWidth}x${newHeight}, 压缩比: ${scale.toFixed(2)}`)
  
  // 创建新的canvas进行压缩
  const compressedCanvas = document.createElement('canvas')
  compressedCanvas.width = newWidth
  compressedCanvas.height = newHeight
  
  const ctx = compressedCanvas.getContext('2d')
  if (!ctx) {
    console.warn('⚠️ 无法获取canvas上下文，使用原图')
    return canvas.toDataURL('image/jpeg', quality)
  }
  
  // 设置高质量的图像缩放
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  // 绘制压缩后的图像
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)
  
  // 转换为JPEG格式以进一步压缩
  const compressedBase64 = compressedCanvas.toDataURL('image/jpeg', quality)
  
  console.log(`📦 压缩完成: ${Math.round(compressedBase64.length / 1024)}KB`)
  
  return compressedBase64
}

// 截取当前页面图片
const captureSlideImage = async (): Promise<string | null> => {
  try {
    console.log('🔍 开始DOM结构调试...')
    
    // 扩展搜索范围，查找所有可能的元素
    const selectors = [
      '.canvas',
      '.viewport-wrapper', 
      '.viewport',
      '.slide-content',
      '.editor-content',
      '[class*="canvas"]',
      '[class*="viewport"]',
      '[class*="slide"]'
    ]
    
    let targetElement: HTMLElement | null = null
    
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement
      if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
        targetElement = element
        console.log(`✅ 找到可用元素: ${selector}`, {
          width: element.offsetWidth,
          height: element.offsetHeight,
          className: element.className
        })
        break
      }
    }
    
    if (!targetElement) {
      console.error('❌ 未找到任何可用的页面元素')
      // 尝试使用整个body作为最后的备选方案
      targetElement = document.body
      console.log('🔄 使用body元素作为备选方案')
    }
    
    let capturedCanvas: HTMLCanvasElement | null = null
    
    // 方法1: 尝试使用html2canvas（如果可用）
    if (window.html2canvas) {
      console.log('🎨 使用html2canvas进行截图...')
      try {
        capturedCanvas = await window.html2canvas(targetElement, {
          backgroundColor: '#ffffff',
          scale: 0.8, // 适中的缩放比例
          useCORS: true,
          allowTaint: true,
          width: targetElement.offsetWidth,
          height: targetElement.offsetHeight,
          logging: false
        })
        
        console.log('✅ html2canvas截图成功')
      } catch (html2canvasError) {
        console.warn('⚠️ html2canvas截图失败:', html2canvasError)
      }
    }
    
    // 方法2: 查找现有的canvas元素
    if (!capturedCanvas) {
      const canvasElements = document.querySelectorAll('canvas')
      console.log('🔍 找到canvas元素数量:', canvasElements.length)
      
      for (let i = 0; i < canvasElements.length; i++) {
        const canvas = canvasElements[i] as HTMLCanvasElement
        if (canvas.width > 0 && canvas.height > 0) {
          try {
            // 测试是否可以访问canvas数据
            canvas.toDataURL('image/png', 0.1)
            capturedCanvas = canvas
            console.log(`✅ 使用第${i + 1}个canvas元素`)
            break
          } catch (canvasError) {
            console.warn(`⚠️ 第${i + 1}个canvas元素不可访问:`, canvasError)
          }
        }
      }
    }
    
    // 方法3: 动态加载html2canvas并重试
    if (!capturedCanvas && !window.html2canvas) {
      console.log('📦 尝试动态加载html2canvas...')
      try {
        await loadHtml2Canvas()
        if (window.html2canvas) {
          capturedCanvas = await window.html2canvas(targetElement, {
            backgroundColor: '#ffffff',
            scale: 0.8,
            useCORS: true,
            allowTaint: true
          })
          console.log('✅ 动态加载html2canvas截图成功')
        }
      } catch (loadError) {
        console.warn('⚠️ 动态加载html2canvas失败:', loadError)
      }
    }
    
    // 方法4: 使用SVG + foreignObject (实验性)
    if (!capturedCanvas) {
      console.log('🧪 尝试使用SVG方法截图...')
      try {
        const svgImage = await captureWithSVG(targetElement)
        if (svgImage) {
          // 将SVG图像转换为canvas
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = svgImage
          })
          
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            capturedCanvas = canvas
            console.log('✅ SVG方法截图成功')
          }
        }
      } catch (svgError) {
        console.warn('⚠️ SVG方法截图失败:', svgError)
      }
    }
    
    // 如果获取到了canvas，进行压缩处理
    if (capturedCanvas) {
      const originalSize = Math.round(capturedCanvas.toDataURL('image/png').length / 1024)
      console.log(`📏 原始图片大小: ${originalSize}KB`)
      
      // 压缩图片：最大宽度800px，最大高度600px，质量0.6
      const compressedBase64 = compressImage(capturedCanvas, 800, 600, 0.6)
      const compressedSize = Math.round(compressedBase64.length / 1024)
      
      console.log(`✅ 图片压缩完成: ${originalSize}KB -> ${compressedSize}KB (压缩率: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`)
      
      // 如果压缩后仍然太大（超过200KB），进一步压缩
      if (compressedSize > 200) {
        console.log('📦 图片仍然较大，进行二次压缩...')
        const furtherCompressed = compressImage(capturedCanvas, 600, 450, 0.4)
        const finalSize = Math.round(furtherCompressed.length / 1024)
        console.log(`✅ 二次压缩完成: ${compressedSize}KB -> ${finalSize}KB`)
        return furtherCompressed
      }
      
      return compressedBase64
    }
    
    console.error('❌ 所有截图方法都失败了')
    return null
    
  } catch (error) {
    console.error('❌ 截图过程发生错误:', error)
    return null
  }
}

// 动态加载html2canvas库
const loadHtml2Canvas = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load html2canvas'))
    document.head.appendChild(script)
  })
}

// 使用SVG + foreignObject进行截图
const captureWithSVG = (element: HTMLElement): Promise<string | null> => {
  try {
    const rect = element.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', width.toString())
    svg.setAttribute('height', height.toString())
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    
    // 创建foreignObject
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
    foreignObject.setAttribute('width', '100%')
    foreignObject.setAttribute('height', '100%')
    
    // 克隆目标元素
    const clonedElement = element.cloneNode(true) as HTMLElement
    foreignObject.appendChild(clonedElement)
    svg.appendChild(foreignObject)
    
    // 转换为base64
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBase64 = btoa(unescape(encodeURIComponent(svgData)))
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`
    
    // 使用Image加载SVG并转换为Canvas
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png', 0.8))
        } else {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    })
    
  } catch (error) {
    console.error('SVG截图失败:', error)
    return Promise.resolve(null)
  }
}

// 取消保存
const handleCancel = () => {
  dialogVisible.value = false
}

// 保存模板
const handleSave = async () => {
  if (saving.value) return
  
  try {
    if (!templateForm.name.trim() || !templateForm.templateType) {
      message.error('请输入模板名称和选择模板类型')
      return
    }
  } catch (err) {
    message.error('请填写所有必填项')
    return
  }
  
  saving.value = true
  
  try {
    const slidesStore = useSlidesStore()
    const { currentSlide, theme, viewportRatio, viewportSize } = storeToRefs(slidesStore)
    
    if (!currentSlide.value) {
      message.error('当前页面为空，无法保存为模板')
      return
    }

    // 深拷贝当前幻灯片数据并清理不需要的字段
    const cleanSlideData = (slide: any) => {
      const cleaned = JSON.parse(JSON.stringify(slide))
      // 移除 aiData 和 metadata 字段
      delete cleaned.aiData
      delete cleaned.metadata
      return cleaned
    }

    // 构建模板数据
    const templateData = {
      title: templateForm.name,
      width: viewportSize.value,
      height: viewportSize.value * viewportRatio.value,
      theme: theme.value,
      slides: [cleanSlideData(currentSlide.value)]
    }

    // 清理 slideData 中的 base64 图片数据
    const cleanedTemplateData = cleanBase64Images(templateData)

    // 构建完整的保存数据，包含AI分析的特征
    const saveData = {
      slideData: cleanedTemplateData,
      templateName: templateForm.name,
      features: aiExtractedFeatures.value // 包含AI分析的完整数据
    }

    console.log('💾 保存模板数据（包含AI特征）:', saveData)

    // 调用后端保存接口
    const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api/ai/save-template' : '/api/ai/save-template'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saveData)
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

// 声明全局类型
declare global {
  interface Window {
    html2canvas?: any
  }
}
</script>

<style lang="scss" scoped>
.save-template-dialog {
  padding: 12px;
  color: #333;

  .header {
    text-align: center;
    margin-bottom: 24px;
    
    .title {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(270deg, #d897fd, #33bcfc);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 14px;
      color: #888;
      margin-top: 8px;
    }
  }
  
  .form-content {
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px 16px;
    margin: 0 -16px;
  }

  .form-item {
    margin-bottom: 18px;
    
    .label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 8px;
    }
    
    .input, .textarea, .select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background-color: #fdfdff;
      transition: all 0.2s ease-in-out;
      
      &:focus {
        outline: none;
        border-color: #33bcfc;
        box-shadow: 0 0 0 2px rgba(51, 188, 252, 0.2);
      }
    }
    
    .textarea {
      resize: vertical;
      min-height: 70px;
    }
  }
  
  .checkbox-group {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    
    .checkbox-item {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #33bcfc;
        color: #33bcfc;
      }

      &.checked {
        border-color: #d897fd;
        background-color: #faf5ff;
        color: #9f7aea;
        font-weight: 500;
      }

      .checkbox-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
    }
  }
  
  .tag-input-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background-color: #fdfdff;
    transition: all 0.2s ease-in-out;

    &:focus-within {
      border-color: #33bcfc;
      box-shadow: 0 0 0 2px rgba(51, 188, 252, 0.2);
    }

    .tags {
      display: contents;
    }

    .tag {
      display: flex;
      align-items: center;
      gap: 4px;
      background-color: #f0f5ff;
      color: #2d68f4;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 13px;

      .tag-remove {
        background: none;
        border: none;
        color: #2d68f4;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        opacity: 0.7;
        &:hover { opacity: 1; }
      }
    }

    .tag-input-field {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      min-width: 150px;
      font-size: 14px;
      height: 28px;
    }
  }

  .tag-suggestions {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    .tag-suggestion {
      background: #f7fafc;
      color: #718096;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background-color: #edf2f7;
        color: #4a5568;
        transform: translateY(-1px);
      }
    }
  }
  
  .ai-extract-section {
    margin-top: 24px;
    
    .btn-ai-extract {
      width: 100%;
      padding: 12px 16px;
      background: linear-gradient(135deg, #868cff 0%, #4318ff 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      
      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }
      
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    
    .ai-extract-tip {
      margin-top: 10px;
      font-size: 12px;
      color: #a0aec0;
      text-align: center;
    }
  }
  
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #f1f5f9;
    
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid;
      
      &.btn-cancel {
        background: #fff;
        border-color: #e2e8f0;
        color: #4a5568;
        
        &:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
        }
      }
      
      &.btn-primary {
        background: #33bcfc;
        border-color: #33bcfc;
        color: white;
        
        &:hover:not(:disabled) {
          background: #00a9f4;
          border-color: #00a9f4;
          box-shadow: 0 2px 8px rgba(51, 188, 252, 0.3);
        }
        
        &:disabled {
          background: #a0aec0;
          border-color: #a0aec0;
          cursor: not-allowed;
        }
      }
    }
  }
}
</style>

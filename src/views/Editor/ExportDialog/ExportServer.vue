<template>
  <div class="export-server-dialog">
    <div class="thumbnails-view">
      <div class="thumbnails">
        <ThumbnailSlide 
          class="thumbnail" 
          v-for="slide in renderSlides" 
          :key="slide.id" 
          :slide="slide" 
          :size="1600" 
          :visible="true"
        />
      </div>
    </div>
    <div class="configs">
      <div class="row">
        <div class="title">PPT标题：</div>
        <div class="config-item">
          <Input v-model:value="pptTitle" placeholder="请输入PPT标题" />
        </div>
      </div>

      <div class="row">
        <div class="title">教材：</div>
        <div class="config-item">
          <select v-model="selectedTextbook" class="textbook-select">
            <option value="">请选择教材</option>
            <option value="人教版">人教版</option>
            <option value="苏教版">苏教版</option>
            <option value="北师大版">北师大版</option>
            <option value="外研版">外研版</option>
            <option value="牛津版">牛津版</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div class="title">年级：</div>
        <div class="config-item">
          <select v-model="selectedGrade" class="grade-select">
            <option value="">请选择年级</option>
            <option value="一年级">一年级</option>
            <option value="二年级">二年级</option>
            <option value="三年级">三年级</option>
            <option value="四年级">四年级</option>
            <option value="五年级">五年级</option>
            <option value="六年级">六年级</option>
            <option value="初一">初一</option>
            <option value="初二">初二</option>
            <option value="初三">初三</option>
          </select>
        </div>
      </div>

      <!-- 进度显示 -->
      <div class="row" v-if="saving">
        <div class="title">保存进度：</div>
        <div class="config-item">
          <div class="progress-info">
            <div class="progress-text">{{ progressText }}</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="btns">
      <Button 
        class="btn save" 
        type="primary" 
        @click="saveToServer()" 
        :disabled="saving"
      >
        {{ saving ? '保存中...' : '保存' }}
      </Button>
      <Button class="btn close" @click="emit('close')">关闭</Button>
    </div>

    <FullscreenSpin :loading="saving" :tip="progressText" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import api from '@/services/config'
import message from '@/utils/message'

import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Switch from '@/components/Switch.vue'
import Slider from '@/components/Slider.vue'
import Button from '@/components/Button.vue'
import RadioButton from '@/components/RadioButton.vue'
import RadioGroup from '@/components/RadioGroup.vue'
import Input from '@/components/Input.vue'

const emit = defineEmits<{
  (event: 'close'): void
}>()

const slidesStore = useSlidesStore()
const { slides, currentSlide, title } = storeToRefs(slidesStore)

const rangeType = ref<'all' | 'current' | 'custom'>('all')
const range = ref<[number, number]>([1, slides.value.length])
const format = ref<'jpeg' | 'png'>('jpeg')
const quality = ref(1)
const ignoreWebfont = ref(true)
const pptTitle = ref(title.value || 'PPT演示文稿')
const selectedTextbook = ref('')
const selectedGrade = ref('')
const saving = ref(false)
const currentSlideIndex = ref(0)
const totalSlides = ref(0)

const renderSlides = computed(() => {
  if (rangeType.value === 'all') return slides.value
  if (rangeType.value === 'current') return [currentSlide.value]
  return slides.value.filter((item, index) => {
    const [min, max] = range.value
    return index >= min - 1 && index <= max - 1
  })
})

const progressPercent = computed(() => {
  if (totalSlides.value === 0) return 0
  return Math.round((currentSlideIndex.value / totalSlides.value) * 100)
})

const progressText = computed(() => {
  if (!saving.value) return '准备保存...'
  if (currentSlideIndex.value === 0) return '正在准备...'
  if (currentSlideIndex.value <= totalSlides.value) {
    return `正在处理第 ${currentSlideIndex.value} 页，共 ${totalSlides.value} 页`
  }
  return '正在完成保存...'
})

// 等待渲染完成的函数
const waitForRender = async (): Promise<void> => {
  // 等待Vue的响应式更新完成
  await nextTick()
  
  // 等待浏览器完成渲染
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

// 等待slide完全加载的函数
const waitForSlideLoad = async (): Promise<void> => {
  // 首先等待基本渲染
  await waitForRender()
  
  // 查找canvas元素并等待渲染
  const canvasElements = document.querySelectorAll('canvas')
  const canvasPromises = Array.from(canvasElements).map(() => {
    return new Promise<void>(resolve => {
      setTimeout(resolve, 300) // 给canvas足够的渲染时间
    })
  })
  
  // 等待图片加载
  const images = document.querySelectorAll('img')
  const imagePromises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve()
    return new Promise<void>(resolve => {
      img.onload = () => resolve()
      img.onerror = () => resolve() // 即使加载失败也继续
      setTimeout(resolve, 2000) // 设置超时
    })
  })
  
  // 等待SVG渲染
  const svgs = document.querySelectorAll('svg')
  const svgPromises = Array.from(svgs).map(() => {
    return new Promise<void>(resolve => {
      setTimeout(resolve, 200)
    })
  })
  
  // 等待所有资源加载完成
  await Promise.all([...imagePromises, ...svgPromises, ...canvasPromises])
  
  // 最后再等待一次渲染确保所有内容都已显示
  await waitForRender()
}

// 压缩图片
const compressImage = (canvas: HTMLCanvasElement, maxWidth: number = 800, maxHeight: number = 600, quality: number = 1): string => {
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

// 动态加载html2canvas库
const loadHtml2Canvas = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.onload = () => {
      console.log('✅ html2canvas库加载成功')
      resolve()
    }
    script.onerror = () => {
      console.error('❌ html2canvas库加载失败')
      reject(new Error('Failed to load html2canvas'))
    }
    document.head.appendChild(script)
  })
}

// 使用SVG + foreignObject进行截图
const captureWithSVG = async (element: HTMLElement): Promise<string | null> => {
  try {
    const { width, height } = element.getBoundingClientRect()
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${element.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `
    
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png', 0.8))
        }
        else {
          resolve(null)
        }
        URL.revokeObjectURL(svgUrl)
      }
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve(null)
      }
      img.src = svgUrl
    })
    
  }
  catch (error) {
    console.error('SVG截图失败:', error)
    return Promise.resolve(null)
  }
}

// 声明全局类型
declare global {
  interface Window {
    html2canvas?: any
  }
}

// 截取当前页面图片
const captureSlideImage = async (): Promise<string | null> => {
  try {
    console.log('🔍 开始DOM结构调试...')
    
    // 扩展搜索范围，查找所有可能的元素
    const selectors = [
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
      }
      catch (html2canvasError) {
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
          }
          catch (canvasError) {
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
      }
      catch (loadError) {
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
      }
      catch (svgError) {
        console.warn('⚠️ SVG方法截图失败:', svgError)
      }
    }
    
    // 如果获取到了canvas，进行压缩处理
    if (capturedCanvas) {
      const originalSize = Math.round(capturedCanvas.toDataURL('image/png').length / 1024)
      console.log(`📏 原始图片大小: ${originalSize}KB`)
      
      // 压缩图片：最大宽度800px，最大高度600px，质量0.6
      const compressedBase64 = compressImage(capturedCanvas, 800, 600, quality.value)
      const compressedSize = Math.round(compressedBase64.length / 1024)
      
      console.log(`✅ 图片压缩完成: ${originalSize}KB -> ${compressedSize}KB (压缩率: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`)
      
      // 如果压缩后仍然太大（超过200KB），进一步压缩
      if (compressedSize > 200) {
        console.log('📦 图片仍然较大，进行二次压缩...')
        const furtherCompressed = compressImage(capturedCanvas, 600, 450, 1)
        const finalSize = Math.round(furtherCompressed.length / 1024)
        console.log(`✅ 二次压缩完成: ${compressedSize}KB -> ${finalSize}KB`)
        return furtherCompressed
      }
      
      return compressedBase64
    }
    
    console.error('❌ 所有截图方法都失败了')
    return null
    
  }
  catch (error) {
    console.error('❌ 截图过程发生错误:', error)
    return null
  }
}

// 保存到服务器
const saveToServer = async () => {
  if (!pptTitle.value.trim()) {
    message.error('请输入PPT标题')
    return
  }

  saving.value = true
  currentSlideIndex.value = 0
  totalSlides.value = renderSlides.value.length
  
  // 保存当前slide索引，完成后恢复
  const originalSlideIndex = slidesStore.slideIndex

  try {
    console.log(`🚀 开始串行截图，共 ${totalSlides.value} 页`)
    
    const slides = []
    
    // 串行处理每个slide
    for (let i = 0; i < renderSlides.value.length; i++) {
      currentSlideIndex.value = i + 1
      console.log(`📸 开始处理第 ${i + 1} 页`)
      
      // 获取目标slide的索引
      let targetSlideIndex = i
      if (rangeType.value === 'current') {
        targetSlideIndex = slidesStore.slideIndex
      } else if (rangeType.value === 'custom') {
        targetSlideIndex = range.value[0] - 1 + i
      }
      
      // 切换到目标slide
      slidesStore.updateSlideIndex(targetSlideIndex)
      console.log(`🔄 切换到第 ${targetSlideIndex + 1} 页`)
      
      // 等待DOM更新和slide完全加载
      await nextTick()
      await waitForSlideLoad()
      
      // 添加额外等待时间确保渲染完成
       await new Promise<void>(resolve => setTimeout(resolve, 500))
       
       // 截图当前页面
       let imageData = null
       let retryCount = 0
       const maxRetries = 3
       
       while (!imageData && retryCount <= maxRetries) {
         if (retryCount > 0) {
           console.log(`第 ${i + 1} 页截图重试第 ${retryCount} 次`)
           // 重试前再次等待
           await waitForSlideLoad()
           await new Promise<void>(resolve => setTimeout(resolve, 300))
         }
         
         imageData = await captureSlideImage()
         retryCount++
       }
       
       if (imageData) {
         slides.push({
           index: i + 1,
           slideId: renderSlides.value[i].id,
           imageData: imageData
         })
         console.log(`✅ 第 ${i + 1} 页截图成功`)
       }
       else {
         console.error(`❌ 第 ${i + 1} 页截图失败，已重试 ${maxRetries} 次`)
         // 即使某页失败也继续处理下一页
       }
     }

    if (slides.length === 0) {
      throw new Error('所有幻灯片截图都失败了')
    }

    // 准备发送到服务器的数据
    const postData = {
      title: pptTitle.value.trim(),
      format: format.value,
      quality: quality.value,
      slideCount: slides.length,
      rangeType: rangeType.value,
      textbook: selectedTextbook.value,
      grade: selectedGrade.value,
      slides: slides
    }

    // 发送到服务器
    console.log('📤 开始上传到服务器...')
    currentSlideIndex.value = totalSlides.value + 1
    const response = await api.post('/api/ppt/save', postData) as any
    
    saving.value = false
    // 恢复原来的slide索引
    slidesStore.updateSlideIndex(originalSlideIndex)
    
    console.log('🎉 保存完成！')
    message.success(`PPT已成功保存到服务器！共 ${slides.length} 页`)
    
    // 可以在这里处理服务器返回的数据，比如显示保存的ID等
    if (response && response.id) {
      message.success(`保存成功，ID: ${response.id}`)
    }
  }
  catch (error) {
    saving.value = false
    // 恢复原来的slide索引
    slidesStore.updateSlideIndex(originalSlideIndex)
    
    console.error('❌ 保存到服务器失败:', error)
    message.error(error instanceof Error ? error.message : '保存到服务器失败')
  }
}
</script>

<style lang="scss" scoped>
.export-server-dialog {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.thumbnails-view {
  @include absolute-0();

  &::after {
    content: '';
    background-color: #fff;
    @include absolute-0();
  }
}
.configs {
  width: 350px;
  height: calc(100% - 100px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 1;

  .row {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 25px;
  }

  .title {
    width: 100px;
    position: relative;

    &::after {
      content: attr(data-range);
      position: absolute;
      top: 20px;
      left: 0;
    }
  }
  .config-item {
    flex: 1;
  }

  .textbook-select,
  .grade-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    background-color: #fff;
    font-size: 14px;
    color: #333;
    outline: none;
    transition: border-color 0.3s;

    &:hover {
      border-color: #40a9ff;
    }

    &:focus {
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }
  }

  .progress-info {
    width: 100%;

    .progress-text {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background-color: #f0f0f0;
      border-radius: 3px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background-color: #1890ff;
        transition: width 0.3s ease;
      }
    }
  }
}
.btns {
  width: 300px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;

  .save {
    flex: 1;
  }
  .close {
    width: 100px;
    margin-left: 10px;
  }
}
</style>
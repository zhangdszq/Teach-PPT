<template>
  <div class="export-server-dialog">
    <div class="thumbnails-view">
      <div class="thumbnails">
        <ThumbnailSlide class="thumbnail" v-for="slide in renderSlides" :key="slide.id" :slide="slide" :size="1600"
          :visible="true" />
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

      <div class="row">
        <div class="title">图片质量：</div>
        <div class="config-item">
          <div class="quality-control">
            <Slider v-model:value="imageQuality" :min="0.1" :max="1" :step="0.1" class="quality-slider" />
            <div class="quality-text">{{ Math.round(imageQuality * 100) }}%</div>
          </div>
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

      <div class="row" v-if="showConfirmSave">
        <div class="title">上传状态：</div>
        <div class="config-item">
          <div class="upload-status">
            <div class="status-text">已成功上传 {{ uploadedSlides.length }} 页</div>
            <div class="status-detail">请点击"确认保存"按钮完成最终保存</div>
          </div>
        </div>
      </div>
    </div>

    <div class="btns">
      <Button class="btn save" type="primary" @click="saveToServer()" :disabled="saving || showConfirmSave" v-if="!showConfirmSave">
        {{ saving ? (isEditMode ? '更新中...' : '保存中...') : (isEditMode ? '开始更新' : '开始上传') }}
      </Button>
      <Button class="btn confirm-save" type="primary" @click="confirmSave()" v-if="showConfirmSave">
        {{ isEditMode ? '确认更新' : '确认保存' }} ({{ uploadedSlides.length }} 页)
      </Button>
      <Button class="btn close" @click="handleClose()" :disabled="saving">关闭</Button>
    </div>

    <FullscreenSpin :loading="saving" :tip="progressText" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useSlidesStore } from '@/store'
import api from '@/services'
import message from '@/utils/message'
import { captureForServer } from '@/utils/screenshot'

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

// 获取URL参数中的pptId
const getUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return {
    pptId: urlParams.get('pptId')
  }
}

// 重置状态
const resetState = () => {
  saving.value = false
  currentSlideIndex.value = 0
  totalSlides.value = 0
  uploadedSlides.value = []
  showConfirmSave.value = false
  // 如果URL中没有pptId，则重置为空字符串
  const { pptId: urlPptId } = getUrlParams()
  if (!urlPptId) {
    pptId.value = ''
  }
}

// 关闭对话框
const handleClose = () => {
  resetState()
  emit('close')
}

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
const imageQuality = ref(1) // 默认95%质量，保持高质量但可控
const saving = ref(false)
const currentSlideIndex = ref(0)
const totalSlides = ref(0)
const uploadedSlides = ref<any[]>([])
const showConfirmSave = ref(false)
const pptId = ref<string>('')
const isEditMode = ref(false) // 是否为编辑模式

// 初始化时检查是否为编辑模式
const initializeEditMode = () => {
  const { pptId: urlPptId } = getUrlParams()
  if (urlPptId) {
    pptId.value = urlPptId
    isEditMode.value = true
    console.log('编辑模式：更新现有PPT', urlPptId)
  }
  else {
    isEditMode.value = false
    console.log('新建模式：创建新PPT')
  }
}

// 组件挂载时初始化
initializeEditMode()

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
  if (showConfirmSave.value) {
    return `已上传 ${uploadedSlides.value.length} 页，等待确认保存`
  }
  return '正在处理...'
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

// 图片质量处理 - 已移至统一截图函数中
// const processImageQuality = (canvas: HTMLCanvasElement, quality: number): string => {
//   // 此函数已整合到统一截图函数中
// }

// 动态加载html2canvas库 - 已移至统一截图函数中
// const loadHtml2Canvas = (): Promise<void> => {
//   // 此函数已整合到统一截图函数中
// }

// 使用SVG + foreignObject进行截图 - 已移至统一截图函数中
// const captureWithSVG = (element: HTMLElement): Promise<string | null> => {
//   // 此函数已整合到统一截图函数中
// }

// 声明全局类型
declare global {
  interface Window {
    html2canvas?: any
  }
}

// 截取当前页面图片 - 使用统一的截图函数
const captureSlideImage = async (): Promise<string | null> => {
  return await captureForServer(undefined, imageQuality.value, 'ExportServer')
}

// 单页上传到服务器
const uploadSingleSlide = async (slideIndex: number, imageData: string, slideData: any) => {
  try {
    // 检查并记录 aiData 字段
    if (slideData.aiData) {
      console.log(`🤖 第 ${slideIndex} 页包含 aiData:`, slideData.aiData)
    }
    else {
      console.log(`⚠️ 第 ${slideIndex} 页不包含 aiData 字段`)
    }
    
    const postData = {
      pptId: pptId.value,
      title: pptTitle.value.trim(),
      format: format.value,
      imageQuality: imageQuality.value,
      rangeType: rangeType.value,
      textbook: selectedTextbook.value,
      grade: selectedGrade.value,
      slideIndex: slideIndex,
      slideId: slideData.id,
      imageData: imageData,
      slideData: slideData
    }

    console.log(`📤 上传第 ${slideIndex} 页到服务器...`)
    const response = await api.uploadSlide(postData) as any
    
    if (response && response.status === 'success' && response.data && response.data.success) {
      console.log(`✅ 第 ${slideIndex} 页上传成功`)
      return response
    }
    throw new Error(`第 ${slideIndex} 页上传失败`)
  }
  catch (error) {
    console.error(`❌ 第 ${slideIndex} 页上传失败:`, error)
    throw error
  }
}

// 最终确认保存
const confirmSave = async () => {
  if (uploadedSlides.value.length === 0) {
    message.error('没有已上传的幻灯片')
    return
  }

  try {
    const postData = {
      pptId: pptId.value,
      title: pptTitle.value.trim(),
      format: format.value,
      imageQuality: imageQuality.value.toString(),
      rangeType: rangeType.value,
      textbook: selectedTextbook.value,
      grade: selectedGrade.value
    }

    console.log('📤 发送最终确认保存请求...')
    const response = await api.confirmSave(postData) as any

    if (response && response.status === 'success' && response.data && response.data.success) {
      const isUpdate = response.data.isUpdate || false
      if (isUpdate) {
        message.success(`PPT已成功更新！共 ${uploadedSlides.value.length} 页`)
      }
      else {
        message.success(`PPT已成功保存到服务器！共 ${uploadedSlides.value.length} 页`)
      }
      
      
      if (response.data.id) {
        message.success(`${isUpdate ? '更新' : '保存'}成功，ID: ${response.data.id}`)
      }
      
      // 保存成功后关闭对话框
      setTimeout(() => {
        handleClose()
      }, 1500)
      return
    }
    throw new Error('最终保存确认失败')
  }
  catch (error) {
    console.error('❌ 最终保存确认失败:', error)
    message.error(error instanceof Error ? error.message : '最终保存确认失败')
  }
}

// 保存到服务器（修改为逐页上传）
const saveToServer = async () => {
  if (!pptTitle.value.trim()) {
    message.error('请输入PPT标题')
    return
  }
  
  if (!selectedTextbook.value) {
    message.error('请选择教材')
    return
  }
  
  if (!selectedGrade.value) {
    message.error('请选择年级')
    return
  }

  // 根据模式设置PPT ID
  if (!isEditMode.value) {
    // 新建模式：生成唯一的PPT ID
    pptId.value = nanoid()
    console.log('新建PPT，生成ID:', pptId.value)
  }
  else {
    // 编辑模式：使用现有的PPT ID
    console.log('更新现有PPT，ID:', pptId.value)
  }
  
  
  saving.value = true
  currentSlideIndex.value = 0
  totalSlides.value = renderSlides.value.length
  uploadedSlides.value = []

  // 保存当前slide索引，完成后恢复
  const originalSlideIndex = slidesStore.slideIndex

  try {
    console.log(`🚀 开始逐页截图上传，共 ${totalSlides.value} 页`)

    // 串行处理每个slide
    for (let i = 0; i < renderSlides.value.length; i++) {
      currentSlideIndex.value = i + 1
      console.log(`📸 开始处理第 ${i + 1} 页`)

      // 获取目标slide的索引
      let targetSlideIndex = i
      if (rangeType.value === 'current') {
        targetSlideIndex = slidesStore.slideIndex
      }
      else if (rangeType.value === 'custom') {
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
        // 立即上传当前页
        try {
          const slideData = renderSlides.value[i]
          // 调试：记录slideData中的remark字段
          console.log(`🔍 第 ${i + 1} 页 slideData.remark:`, slideData.remark)
          const uploadResult = await uploadSingleSlide(i + 1, imageData, slideData)
          uploadedSlides.value.push({
            index: i + 1,
            slideId: slideData.id,
            id: uploadResult.id
          })
          console.log(`✅ 第 ${i + 1} 页截图并上传成功`)
        }
        catch (uploadError) {
          console.error(`❌ 第 ${i + 1} 页上传失败:`, uploadError)
          // 继续处理下一页，但记录失败
        }
      }
      else {
        console.error(`❌ 第 ${i + 1} 页截图失败，已重试 ${maxRetries} 次`)
        // 即使某页失败也继续处理下一页
      }
    }

    saving.value = false
    // 恢复原来的slide索引
    slidesStore.updateSlideIndex(originalSlideIndex)

    if (uploadedSlides.value.length === 0) {
      throw new Error('所有幻灯片截图或上传都失败了')
    }

    console.log('🎉 所有页面处理完成！')
    message.success(`已成功上传 ${uploadedSlides.value.length} 页到服务器，请点击确认保存按钮完成最终保存`)
    showConfirmSave.value = true

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
    border-radius: 4px;
    background-color: #fff;
    font-size: 14px;
    color: #333;
    outline: none;

    &:hover {
      border-color: #40a9ff;
    }

    &:focus {
      border-color: #40a9ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }
  }

  .quality-control {
    display: flex;
    align-items: center;
    gap: 12px;

    .quality-slider {
      flex: 1;
    }

    .quality-text {
      min-width: 40px;
      font-size: 14px;
      color: #666;
      text-align: right;
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

  .upload-status {
    width: 100%;

    .status-text {
      font-size: 14px;
      color: #d14424;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .status-detail {
      font-size: 12px;
      color: #666;
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

  .confirm-save {
    flex: 1;
    background-color: #52c41a;
    border-color: #52c41a;

    &:hover {
      background-color: #73d13d;
      border-color: #73d13d;
    }
  }

  .close {
    width: 100px;
    margin-left: 10px;
  }
}
</style>
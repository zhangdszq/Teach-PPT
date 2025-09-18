<template>
  <template v-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else-if="!pptGenerating" loading :mask="false" />
  
  <!-- PPT生成时的半透明遮罩 -->
  <FullscreenSpin 
    v-if="pptGenerating" 
    :loading="pptGenerating" 
    :mask="true" 
    tip="正在生成AI教学PPT，请耐心等待 ..." 
  />
</template>



<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import api from '@/services'

import Editor from './views/Editor/index.vue'
import Screen from './views/Screen/index.vue'
import Mobile from './views/Mobile/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'

const _isPC = isPC()

// 添加PPT生成状态管理
const pptGenerating = ref(false)

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const { databaseId } = storeToRefs(mainStore)
const { slides } = storeToRefs(slidesStore)
const { screening } = storeToRefs(useScreenStore())

if (import.meta.env.MODE !== 'development') {
  window.onbeforeunload = () => false
}

// 获取URL参数
const getUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return {
    pptId: urlParams.get('pptId'),
    lessonId: urlParams.get('lessonId'),
    grade: urlParams.get('grade'),
    courseType: urlParams.get('courseType')
  }
}

onMounted(async () => {
  const { pptId, lessonId, grade, courseType } = getUrlParams()
  
  let slidesData
  
  if (pptId) {
    // 如果有pptId参数，从服务器加载对应的PPT数据
    try {
      console.log('Loading PPT with ID:', pptId)
      const response = await api.getPPTById(pptId)
      if (response && response.status === 'success' && response.data) {
        slidesData = response.data.slides || []
        
        // 检查并记录 aiData 字段
        console.log('🔍 检查从服务器加载的 PPT 数据:')
        console.log('📊 PPT 基本信息:', {
          pptId: response.data.pptId,
          title: response.data.title,
          slideCount: response.data.slideCount
        })
        
        if (slidesData && slidesData.length > 0) {
          slidesData.forEach((slide: any, index: number) => {
            if (slide.aiData) {
              console.log(`🤖 第 ${index + 1} 页包含 aiData:`, slide.aiData)
            }
            else {
              console.log(`⚠️ 第 ${index + 1} 页不包含 aiData 字段`)
            }
          })
        }
        
        // 如果有标题，设置标题
        if (response.data.title) {
          slidesStore.setTitle(response.data.title)
        }
      }
      else {
        console.error('Failed to load PPT:', response)
        // 加载失败时使用默认模板
        slidesData = await api.getFileData('slides')
      }
    }
    catch (error) {
      console.error('Error loading PPT:', error)
      // 加载失败时使用默认模板
      slidesData = await api.getFileData('slides')
    }
  }
  else if (lessonId && grade && courseType) {
    // 如果有lessonId参数，调用AI PPT接口生成数据
    try {
      console.log('🤖 使用lessonId生成AI PPT:', { lessonId, grade, courseType })
      
      // 显示PPT生成遮罩
      pptGenerating.value = true
      
      // 构造课程内容，这里可以根据lessonId获取具体的课程内容
      // 暂时使用lessonId作为内容，实际应用中可能需要从其他接口获取课程详细内容
      const content = `课程ID: ${lessonId}`
      
      // 使用复用的AI PPT生成函数
      const { generateAIPPT } = await import('@/utils/aiPPTGenerator')
      
      await generateAIPPT(
        {
          content,
          courseType,
          grade,
          style: 'modern',
          model: 'gemini-2.0-flash',
          lessonId: parseInt(lessonId)
        },
        (progress) => {
          console.log('🔄 生成进度:', progress)
        },
        () => {
          console.log('✅ AI PPT生成完成')
          // 隐藏PPT生成遮罩
          pptGenerating.value = false
        },
        (error) => {
          console.error('❌ AI PPT生成失败:', error)
          // 生成失败时也要隐藏遮罩
          pptGenerating.value = false
        }
      )
      
      return // 提前返回，避免重复设置slides
    }
    catch (error) {
      console.error('❌ AI PPT生成失败:', error)
      // 生成失败时隐藏遮罩
      pptGenerating.value = false
      // 生成失败时使用默认模板
      slidesData = await api.getFileData('slides')
    }
  }
  else {
    // 没有pptId或lessonId参数时，加载默认模板
    slidesData = await api.getFileData('slides')
  }
  
  // 只有在非lessonId流程中才设置slides
  if (slidesData) {
    slidesStore.setSlides(slidesData)
  }

  await deleteDiscardedDB()
  snapshotStore.initSnapshotDatabase()
})

// 应用注销时向 localStorage 中记录下本次 indexedDB 的数据库ID，用于之后清除数据库
window.addEventListener('unload', () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
})
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>
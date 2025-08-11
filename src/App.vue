<template>
  <template v-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else  loading :mask="false" />
</template>



<script lang="ts" setup>
import { onMounted } from 'vue'
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
    pptId: urlParams.get('pptId')
  }
}

onMounted(async () => {
  const { pptId } = getUrlParams()
  
  let slidesData
  if (pptId) {
    // 如果有pptId参数，从服务器加载对应的PPT数据
    try {
      console.log('Loading PPT with ID:', pptId)
      const response = await api.getPPTById(pptId)
      if (response && response.status === 'success' && response.data) {
        slidesData = response.data.slides || []
        // 如果有标题，设置标题
        if (response.data.title) {
          slidesStore.setTitle(response.data.title)
        }
      } else {
        console.error('Failed to load PPT:', response)
        // 加载失败时使用默认模板
        slidesData = await api.getFileData('slides')
      }
    } catch (error) {
      console.error('Error loading PPT:', error)
      // 加载失败时使用默认模板
      slidesData = await api.getFileData('slides')
    }
  } else {
    // 没有pptId参数时，加载默认模板
    slidesData = await api.getFileData('slides')
  }
  
  slidesStore.setSlides(slidesData)

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
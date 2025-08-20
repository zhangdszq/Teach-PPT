<template>
  <div class="thumbnail-slide"
    :style="{
      width: size + 'px',
      height: size * viewportRatio + 'px',
    }"
  >
    <div 
      class="elements"
      :style="{
        width: viewportSize + 'px',
        height: viewportSize * viewportRatio + 'px',
        transform: `scale(${scale})`,
      }"
      v-if="visible"
    >
      <div class="background" :style="backgroundStyle"></div>
      
      <!-- iframe类型的slide显示iframe内容 -->
      <div v-if="slide.type === 'iframe'" class="iframe-preview">
        <iframe 
          v-if="slide.iframeSrc"
          :src="slide.iframeSrc"
          class="thumbnail-iframe"
          sandbox="allow-scripts allow-same-origin"
          frameborder="0"
        ></iframe>
        <div v-else class="iframe-placeholder">
          <div class="iframe-icon">🌐</div>
          <div class="iframe-text">互动模板</div>
        </div>
      </div>
      
      <!-- 普通slide显示elements -->
      <template v-else>
        <ThumbnailElement
          v-for="(element, index) in slide.elements"
          :key="element.id"
          :elementInfo="element"
          :elementIndex="index + 1"
        />
      </template>
    </div>
    <div class="placeholder" v-else>加载中 ...</div>
  </div>
</template>

<script lang="ts" setup>
import { computed, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'
import { injectKeySlideScale } from '@/types/injectKey'
import useSlideBackgroundStyle from '@/hooks/useSlideBackgroundStyle'

import ThumbnailElement from './ThumbnailElement.vue'

const props = withDefaults(defineProps<{
  slide: Slide
  size: number
  visible?: boolean
}>(), {
  visible: true,
})

const { viewportRatio, viewportSize } = storeToRefs(useSlidesStore())

const background = computed(() => props.slide.background)
const { backgroundStyle } = useSlideBackgroundStyle(background)

const scale = computed(() => props.size / viewportSize.value)
provide(injectKeySlideScale, scale)
</script>

<style lang="scss" scoped>
.thumbnail-slide {
  background-color: #fff;
  overflow: hidden;
  user-select: none;
}
.elements {
  transform-origin: 0 0;
}
.background {
  width: 100%;
  height: 100%;
  background-position: center;
  position: absolute;
}
.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.iframe-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.thumbnail-iframe {
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: none; /* 缩略图中禁用交互 */
}

.iframe-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.iframe-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.iframe-text {
  font-size: 12px;
  font-weight: 500;
}
</style>
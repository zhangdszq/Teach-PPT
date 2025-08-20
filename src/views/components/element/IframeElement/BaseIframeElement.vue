<template>
  <div 
    class="base-element-iframe"
    :style="{
      top: elementInfo.top + 'px',
      left: elementInfo.left + 'px',
      width: elementInfo.width + 'px',
      height: elementInfo.height + 'px',
    }"
  >
    <div
      class="rotate-wrapper"
      :style="{ transform: `rotate(${elementInfo.rotate}deg)` }"
    >
      <div class="element-content">
        <iframe 
          :src="elementInfo.src"
          class="iframe-element"
          :sandbox="sandboxConfig"
          :allowfullscreen="elementInfo.allowFullscreen"
          frameborder="0"
        ></iframe>
        
        <!-- 缩略图模式下的遮罩层，防止交互 -->
        <div class="iframe-mask" v-if="target === 'thumbnail'"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PPTIframeElement } from '@/types/slides'

const props = withDefaults(defineProps<{
  elementInfo: PPTIframeElement
  target?: 'thumbnail' | 'screen' | 'editor'
}>(), {
  target: 'screen'
})

// 沙箱配置
const sandboxConfig = computed(() => {
  if (props.elementInfo.sandbox && props.elementInfo.sandbox.length > 0) {
    return props.elementInfo.sandbox.join(' ')
  }
  return 'allow-scripts allow-same-origin allow-forms'
})
</script>

<style lang="scss" scoped>
.base-element-iframe {
  position: absolute;
}

.rotate-wrapper {
  width: 100%;
  height: 100%;
}

.element-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.iframe-element {
  width: 100%;
  height: 100%;
  border: none;
}

.iframe-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  pointer-events: auto;
}
</style>
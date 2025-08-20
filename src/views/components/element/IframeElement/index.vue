<template>
  <BaseIframeElement 
    :elementInfo="elementInfo"
    :target="target"
  />
</template>

<script lang="ts" setup>
import BaseIframeElement from './BaseIframeElement.vue'
import type { PPTIframeElement } from '@/types/slides'

defineProps<{
  elementInfo: PPTIframeElement
  target?: 'thumbnail' | 'screen' | 'editor'
}>()
</script>
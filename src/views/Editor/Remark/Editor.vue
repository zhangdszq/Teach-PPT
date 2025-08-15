<template>
  <div class="editor">
    <textarea 
      ref="textareaRef"
      class="remark-textarea"
      :value="props.value"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      placeholder="点击输入演讲者备注"
    ></textarea>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'
import { debounce } from 'lodash'
import { useMainStore } from '@/store'

const props = defineProps<{
  value: string
}>()

const emit = defineEmits<{
  (event: 'update', payload: string): void
}>()

const mainStore = useMainStore()

const textareaRef = ref<HTMLTextAreaElement>()

const handleInput = debounce(function(event: Event) {
  const target = event.target as HTMLTextAreaElement
  const value = target.value
  
  console.log('🔍 备注编辑器输入:', value)
  emit('update', value)
}, 300, { trailing: true })

const handleFocus = () => {
  mainStore.setDisableHotkeysState(true)
}

const handleBlur = () => {
  mainStore.setDisableHotkeysState(false)
}

const updateTextContent = () => {
  if (textareaRef.value) {
    textareaRef.value.value = props.value || ''
    console.log('✅ 备注内容更新成功:', props.value)
  }
}

defineExpose({ updateTextContent })

watch(() => props.value, (newValue, oldValue) => {
  console.log('🔍 备注编辑器props.value变化:', { newValue, oldValue })
  nextTick(() => {
    updateTextContent()
  })
}, { flush: 'post' })
</script>

<style lang="scss" scoped>
.editor {
  height: 100%;
  overflow: hidden;
}

.remark-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 8px;
  font-size: 12px;
  line-height: 1.5;
  font-family: inherit;
  background: transparent;
  
  &::placeholder {
    color: rgba(#666, 0.5);
  }
}
</style>

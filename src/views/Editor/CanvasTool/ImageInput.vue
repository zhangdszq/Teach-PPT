<template>
  <div class="image-input">
    <Tabs 
      :tabs="tabs" 
      v-model:value="type" 
      :tabsStyle="{ marginBottom: '15px' }" 
    />

    <template v-if="type === 'local'">
      <FileInput @change="files => insertImage(files)">
        <div class="upload-area">
          <IconUpload class="icon" />
          <div class="text">点击或拖拽上传</div>
        </div>
      </FileInput>
    </template>

    <template v-if="type === 'web'">
      <Input v-model:value="imageSrc" placeholder="请输入图片地址，e.g. https://xxx.png"></Input>
      <div class="btns">
        <Button @click="emit('close')" style="margin-right: 10px;">取消</Button>
        <Button type="primary" @click="insertImageFromURL()">确认</Button>
      </div>
    </template>

    <template v-if="type === 'ai'">
      <AIImageGenerator 
        @close="emit('close')"
        @insertImage="src => emit('insertImage', src)"
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { getImageDataURL } from '@/utils/image'
import message from '@/utils/message'
import Tabs from '@/components/Tabs.vue'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import FileInput from '@/components/FileInput.vue'
import AIImageGenerator from './AIImageGenerator.vue'

type TypeKey = 'local' | 'web' | 'ai'
interface TabItem {
  key: TypeKey
  label: string
}

const emit = defineEmits<{
  (event: 'insertImage', payload: string): void
  (event: 'close'): void
}>()

const type = ref<TypeKey>('local')

const imageSrc = ref('')

const tabs: TabItem[] = [
  { key: 'local', label: '本地上传' },
  { key: 'web', label: '网络图片' },
  { key: 'ai', label: 'AI生图' },
]

const insertImage = (files: FileList) => {
  const imageFile = files[0]
  if (!imageFile) return
  getImageDataURL(imageFile).then(dataURL => {
    emit('insertImage', dataURL)
  })
}

const insertImageFromURL = () => {
  if (!imageSrc.value) return message.error('请先输入正确的图片地址')
  emit('insertImage', imageSrc.value)
}
</script>

<style lang="scss" scoped>
.image-input {
  width: 480px;
}
.upload-area {
  width: 100%;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px dashed #d9d9d9;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    border-color: $themeColor;
  }

  .icon {
    font-size: 32px;
    color: #999;
  }
  .text {
    font-size: 12px;
    color: #999;
    margin-top: 8px;
  }
}
.btns {
  margin-top: 10px;
  text-align: right;
}
</style>
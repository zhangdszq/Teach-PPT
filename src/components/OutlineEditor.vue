<template>
  <div class="outline-editor">
    <div class="item" 
      :class="[{ 'title': item.title }, `lv-${item.lv}`]"
      v-for="(item, index) in data"
      :key="item.id"
      :data-lv="item.lv"
      :data-id="item.id"
      v-contextmenu="contextmenus" 
    >
      <Input 
        class="editable-text" 
        :value="item.content" 
        v-if="activeItemId === item.id" 
        @blur="$event => handleBlur($event, item)"
        @enter="$event => handleEnter($event, item)"
        @backspace="$event => handleBackspace($event, item)"
      />
      <div class="text" @click="handleFocus(item.id)" v-else>{{ item.content }}</div>

      <div class="flag" :class="{ 'page-flag': item.lv === 2 && item.title }">
        <span v-if="item.lv === 2 && item.title" class="page-number">第{{ getPageNumber(item.id) }}页</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import Input from './Input.vue'

interface OutlineItem {
  id: string
  content: string
  lv: number
  title?: boolean
  pageNumber?: number
}

const props = defineProps<{
  value: string
}>()

const emit = defineEmits<{
  (event: 'update:value', payload: string): void
}>()

const data = ref<OutlineItem[]>([])
const activeItemId = ref('')

// 计算指定项目的页码
const getPageNumber = (itemId: string) => {
  let pageNumber = 1
  for (const item of data.value) {
    if (item.lv === 2 && item.title) {
      if (item.id === itemId) {
        return pageNumber
      }
      pageNumber++
    }
  }
  return 1
}

watch(data, () => {
  let markdown = ''
  const prefixTitle = '#'
  for (const item of data.value) {
    if (item.lv !== 1) markdown += '\n'
    if (item.title) {
      markdown += `${prefixTitle.repeat(item.lv)} ${item.content}`
    } else {
      // 对于列表项，根据层级添加相应的缩进
      const indentLevel = Math.max(0, item.lv - 4)
      const indent = '    '.repeat(indentLevel) // 每个层级4个空格
      markdown += `${indent}- ${item.content}`
    }
  }
  emit('update:value', markdown)
})

onMounted(() => {
  // 统一处理不同类型的换行符
  const normalizedValue = props.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedValue.split('\n')
  const result: OutlineItem[] = []
  let currentTitleLevel = 0 // 当前标题层级
  let isAfterTitle = false // 是否在标题后面

  console.log('🔍 OutlineEditor解析Markdown:', {
    原始内容: props.value,
    行数: lines.length,
    前5行: lines.slice(0, 5)
  })

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    if (!trimmedLine) {
      continue
    }

    const headerMatch = trimmedLine.match(/^(#+)\s*(.*)/)
    const listMatch = trimmedLine.match(/^(\s*)-\s*(.*)/)

    if (headerMatch) {
      const lv = headerMatch[1].length
      const content = headerMatch[2].trim()
      currentTitleLevel = lv
      isAfterTitle = true
      
      result.push({
        id: nanoid(),
        content,
        title: true,
        lv,
      })
    }
    else if (listMatch && isAfterTitle) {
      const indentSpaces = listMatch[1].length
      const content = listMatch[2].trim()
      // 标题后面的列表项，层级为标题层级+1，再加上额外缩进
      const extraIndentLevel = Math.floor(indentSpaces / 4)
      const lv = currentTitleLevel + 1 + extraIndentLevel
      
      result.push({
        id: nanoid(),
        content,
        lv,
      })
    }
    else if (listMatch) {
      // 普通列表项
      const indentSpaces = listMatch[1].length
      const content = listMatch[2].trim()
      const extraIndentLevel = Math.floor(indentSpaces / 4)
      const lv = 4 + extraIndentLevel
      
      result.push({
        id: nanoid(),
        content,
        lv,
      })
      isAfterTitle = false
    }
    else if (trimmedLine) {
      // 普通文本行
      const content = trimmedLine
      
      result.push({
        id: nanoid(),
        content,
        lv: 4
      })
      isAfterTitle = false
    }
  }
  
  console.log('🎯 OutlineEditor解析结果:', {
    总项目数: result.length,
    标题数量: result.filter(item => item.title).length,
    列表项数量: result.filter(item => !item.title).length,
    详细结果: result
  })
  
  data.value = result
})

const handleFocus = (id: string) => {
  activeItemId.value = id

  nextTick(() => {
    const editableRef = document.querySelector('.editable-text input') as HTMLInputElement
    editableRef.focus()
  })
}

const handleBlur = (e: Event, item: OutlineItem) => {
  activeItemId.value = ''
  const value = (e.target as HTMLInputElement).value
  data.value = data.value.map(_item => {
    if (_item.id === item.id) return { ..._item, content: value }
    return _item
  })
}

const handleEnter = (e: Event, item: OutlineItem) => {
  const value = (e.target as HTMLInputElement).value
  if (!value) return

  activeItemId.value = ''

  if (!item.title) {
    const index = data.value.findIndex(_item => _item.id === item.id)
    const newItemId = nanoid()
    data.value.splice(index + 1, 0, { id: newItemId, content: '', lv: 4 })

    nextTick(() => {
      handleFocus(newItemId)
    })
  }
}

const handleBackspace = (e: Event, item: OutlineItem) => {
  if (!item.title) {
    const value = (e.target as HTMLInputElement).value
    if (!value) deleteItem(item.id)
  }
}

const addItem = (itemId: string, pos: 'next' | 'prev', content: string) => {
  const index = data.value.findIndex(_item => _item.id === itemId)
  const item = data.value[index]
  if (!item) return

  const id = nanoid()
  let lv = 4
  let i = 0
  let title = false

  if (pos === 'prev') i = index
  else i = index + 1

  if (item.lv === 1) lv = 2
  else if (item.lv === 2) {
    if (pos === 'prev') lv = 2
    else lv = 3
  }
  else if (item.lv === 3) {
    if (pos === 'prev') lv = 3
    else lv = 4
  }
  else lv = 4

  if (lv < 4) title = true

  data.value.splice(i, 0, { id, content, lv, title })
}

const deleteItem = (itemId: string, isTitle?: boolean) => {
  if (isTitle) {
    const index = data.value.findIndex(item => item.id === itemId)

    const targetIds = [itemId]
    const item = data.value[index]
    for (let i = index + 1; i < data.value.length; i++) {
      const afterItem = data.value[i]
      if (afterItem && afterItem.lv > item.lv) {
        targetIds.push(afterItem.id)
      }
      else break
    }
    data.value = data.value.filter(item => !targetIds.includes(item.id))
  }
  else {
    data.value = data.value.filter(item => item.id !== itemId)
  }
}

const contextmenus = (el: HTMLElement): ContextmenuItem[] => {
  const lv = +el.dataset.lv!
  const id = el.dataset.id!

  if (lv === 1) {
    return [
      {
        text: '添加子级大纲（章）',
        handler: () => addItem(id, 'next', '新的一章'),
      },
    ]
  }
  else if (lv === 2) {
    return [
      {
        text: '上方添加同级大纲（章）',
        handler: () => addItem(id, 'prev', '新的一章'),
      },
      {
        text: '添加子级大纲（节）',
        handler: () => addItem(id, 'next', '新的一节'),
      },
      {
        text: '删除此章',
        handler: () => deleteItem(id, true),
      },
    ]
  }
  else if (lv === 3) {
    return [
      {
        text: '上方添加同级大纲（节）',
        handler: () => addItem(id, 'prev', '新的一节'),
      },
      {
        text: '添加子级大纲（项）',
        handler: () => addItem(id, 'next', '新的一项'),
      },
      {
        text: '删除此节',
        handler: () => deleteItem(id, true),
      },
    ]
  }
  return [
    {
      text: '上方添加同级大纲（项）',
      handler: () => addItem(id, 'prev', '新的一项'),
    },
    {
      text: '下方添加同级大纲（项）',
      handler: () => addItem(id, 'next', '新的一项'),
    },
    {
      text: '删除此项',
      handler: () => deleteItem(id),
    },
  ]
}
</script>

<style lang="scss">
.outline-editor {
  padding: 0 10px;
  padding-left: 40px;
  position: relative;

  .item {
    height: 32px;
    position: relative;

    &.contextmenu-active {
      color: $themeColor;

      .text {
        background-color: rgba($color: $themeColor, $alpha: .08);
      }
    }

    &.title {
      font-weight: 700;
    }
    &.lv-1 {
      font-size: 22px;
    }
    &.lv-2 {
      font-size: 17px;
    }
    &.lv-3 {
      font-size: 15px;
    }
    &.lv-4 {
      font-size: 13px;
      padding-left: 20px;
    }
    &.lv-5 {
      font-size: 13px;
      padding-left: 40px;
    }
    &.lv-6 {
      font-size: 13px;
      padding-left: 60px;
    }
    &.lv-7 {
      font-size: 13px;
      padding-left: 80px;
    }
    &.lv-8 {
      font-size: 13px;
      padding-left: 100px;
    }
  }
  .text {
    height: 100%;
    padding: 0 11px;
    line-height: 32px;
    border-radius: $borderRadius;
    transition: background-color .2s;
    cursor: pointer;
    @include ellipsis-oneline();

    &:hover {
      background-color: rgba($color: $themeColor, $alpha: .08);
    }
  }
  .flag {
    width: 32px;
    height: 32px;
    position: absolute;
    top: 50%;
    left: -40px;
    margin-top: -16px;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;

    &::before {
      content: '';
      width: 1px;
      height: 100%;
      position: absolute;
      left: 50%;
      background-color: rgba($color: $themeColor, $alpha: .1);
    }
    &::after {
      content: '';
      width: 32px;
      height: 22px;
      border-radius: 2px;
      background-color: #fff;
      border: 1px solid $themeColor;
      color: $themeColor;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 12px;
      font-weight: 400;
    }
  }
  .item.lv-1.title .flag::after {
    content: '主题';
  }
  .flag.page-flag {
    .page-number {
      width: 60px;
      height: 22px;
      padding: 0 4px;
      border-radius: 2px;
      background-color: #fff;
      border: 1px solid $themeColor;
      color: $themeColor;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 11px;
      font-weight: 400;
      z-index: 2;
      box-sizing: border-box;
      white-space: nowrap;
    }
    
    &::after {
      display: none; // 隐藏默认的::after伪元素
    }
  }
  .item.lv-3.title .flag::after {
    content: '节';
  }
  .item.lv-4 .flag::after,
  .item.lv-5 .flag::after,
  .item.lv-6 .flag::after,
  .item.lv-7 .flag::after,
  .item.lv-8 .flag::after,
  .item:not(.title) .flag::after {
    opacity: 0;
  }
}
</style>
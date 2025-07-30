<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AI英语教学PPT</span>
      <span class="subtite" v-if="step === 'template'">从下方挑选适合的英语教学模板，开始生成课件</span>
      <span class="subtite" v-else-if="step === 'outline'">确认下方英语课程大纲（点击编辑内容，右键添加/删除教学环节），开始选择模板</span>
      <span class="subtite" v-else>在下方输入您的英语教学主题，如字母学习、单词教学、语法练习、口语训练等</span>
    </div>
    
    <template v-if="step === 'setup'">
      <Input class="input" 
        ref="inputRef"
        v-model:value="keyword" 
        :maxlength="50" 
        placeholder="请输入英语教学主题，如：字母A的认知与发音练习" 
        @enter="createOutline()"
      >
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <div class="submit" type="primary" @click="createOutline()"><IconSend class="icon" /> 生成课程大纲</div>
        </template>
      </Input>
      <div class="recommends">
        <div class="recommend" v-for="(item, index) in recommends" :key="index" @click="setKeyword(item)">{{ item }}</div>
      </div>
      <div class="configs">
        <div class="config-item">
          <div class="label">语言：</div>
          <Select 
            style="width: 80px;"
            v-model:value="language"
            :options="[
              { label: '中文', value: '中文' },
              { label: '英文', value: 'English' },
              { label: '日文', value: '日本語' }, 
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">风格：</div>
          <Select 
            style="width: 80px;"
            v-model:value="style"
            :options="[
              { label: '儿童友好', value: '儿童友好' },
              { label: '互动游戏', value: '互动游戏' },
              { label: '卡通可爱', value: '卡通可爱' },
              { label: '教育专业', value: '教育专业' },
              { label: '启蒙引导', value: '启蒙引导' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">模型：</div>
          <Select 
            style="width: 190px;"
            v-model:value="model"
            :options="[
              { label: 'GLM-4-Flash', value: 'GLM-4-Flash' },
              { label: 'GLM-4-FlashX', value: 'GLM-4-FlashX' },
              { label: 'Douao-1.5-lite-32k', value: 'ark-doubao-1.5-lite-32k' },
              { label: 'Doubao-seed-1.6-flash', value: 'ark-doubao-seed-1.6-flash' },
              { label: 'DeepSeek-v3（限）', value: 'openrouter-deepseek-v3' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">配图：</div>
          <Select 
            style="width: 100px;"
            v-model:value="img"
            :options="[
              { label: '无配图', value: '' },
              { label: '教学图片', value: 'test' },
              { label: 'AI搜图', value: 'ai-search', disabled: true },
              { label: 'AI生图', value: 'ai-create', disabled: true },
            ]"
          />
        </div>
      </div>
    </template>
    <div class="preview" v-if="step === 'outline'">
      <pre ref="outlineRef" v-if="outlineCreating">{{ outline }}</pre>
       <div class="outline-view" v-else>
         <OutlineEditor v-model:value="outline" />
       </div>
      <div class="btns" v-if="!outlineCreating">
        <Button class="btn" type="primary" @click="openTemplateSelect">选择模板</Button>
        <Button class="btn" @click="outline = ''; step = 'setup'">重新设计课程</Button>
      </div>
    </div>

    <FullscreenSpin :loading="loading" tip="正在生成英语教学课件，请耐心等待 ..." />
    
    <!-- 模板选择对话框 -->
    <TemplateSelectDialog 
      :visible="templateSelectVisible"
      @close="closeTemplateSelect"
      @select="handleTemplateSelect"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import api from '@/services'
import useAIPPT from '@/hooks/useAIPPT'
import type { AIPPTSlide } from '@/types/AIPPT'
import type { Slide, SlideTheme } from '@/types/slides'
import message from '@/utils/message'
import { useMainStore, useSlidesStore } from '@/store'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import TemplateSelectDialog from './TemplateSelectDialog.vue'

const mainStore = useMainStore()
const slideStore = useSlidesStore()
const { templates } = storeToRefs(slideStore)
const { AIPPT, presetImgPool, getMdContent } = useAIPPT()

const language = ref('中文')
const style = ref('儿童友好')
const img = ref('')
const keyword = ref('')
const outline = ref('')
const selectedTemplate = ref('template_1')
const loading = ref(false)
const outlineCreating = ref(false)
const outlineRef = ref<HTMLElement>()
const inputRef = ref<InstanceType<typeof Input>>()
const step = ref<'setup' | 'outline' | 'template'>('setup')
const model = ref('GLM-4-Flash')
const templateSelectVisible = ref(false)

const recommends = ref([
  '字母A的认知与发音练习',
  '自然拼读基础入门教学',
  '英语单词卡片互动游戏',
  '简单英语对话情景练习',
  '英语字母书写训练课程',
  '幼儿英语启蒙认知课',
  '英语语音语调纠正练习',
  '英语绘本故事阅读教学',
  '英语课堂互动游戏设计',
  '英语听力基础训练课程',
]) 

onMounted(() => {
  setTimeout(() => {
    inputRef.value!.focus()
  }, 500)
})

const setKeyword = (value: string) => {
  keyword.value = value
  inputRef.value!.focus()
}

const openTemplateSelect = () => {
  templateSelectVisible.value = true
}

const closeTemplateSelect = () => {
  templateSelectVisible.value = false
}

const handleTemplateSelect = (template: any) => {
  selectedTemplate.value = template.id
  templateSelectVisible.value = false
  // 直接开始生成PPT
  createPPT()
}

const createOutline = async () => {
  if (!keyword.value) return message.error('请先输入英语教学主题')

  loading.value = true
  outlineCreating.value = true
  
  const stream = await api.AIPPT_Outline({
    content: keyword.value,
    language: language.value,
    model: model.value,
  })

  loading.value = false
  step.value = 'outline'

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  // 使用真实的AI流式响应
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        outline.value = getMdContent(outline.value)
        outline.value = outline.value.replace(/<!--[\s\S]*?-->/g, '').replace(/<think>[\s\S]*?<\/think>/g, '')
        outlineCreating.value = false
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      outline.value += chunk

      if (outlineRef.value) {
        outlineRef.value.scrollTop = outlineRef.value.scrollHeight + 20
      }

      readStream()
    })
  }
  readStream()
}

const createPPT = async () => {
  loading.value = true

  const stream = await api.AIPPT({
    content: outline.value,
    language: language.value,
    style: style.value,
    model: model.value,
  })

  if (img.value === 'test') {
    // 使用后端API获取测试图片数据
    try {
      const response = await fetch(`${import.meta.env.MODE === 'development' ? 'http://localhost:3001' : 'https://server.pptist.cn'}/api/mock-images`)
      const imgs = await response.json()
      presetImgPool(imgs)
    } catch (error) {
      console.warn('获取测试图片失败，使用默认配置:', error)
      // 如果获取失败，使用空数组或默认图片
      presetImgPool([])
    }
  }

  const templateData = await api.getFileData(selectedTemplate.value)
  const templateSlides: Slide[] = templateData.slides
  const templateTheme: SlideTheme = templateData.theme

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        loading.value = false
        mainStore.setAIPPTDialogState(false)
        slideStore.setTheme(templateTheme)
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      try {
        let text = chunk.replace('```json', '').replace('```', '').trim()
        if (text) {
          console.log('🎯 接收到AI生成的PPT内容:', text);
          const slide: AIPPTSlide = JSON.parse(text)
          AIPPT(templateSlides, [slide])
          loading.value = false
          mainStore.setAIPPTDialogState(false)
          slideStore.setTheme(templateTheme)
          return
        }
      }
      catch (err) {
        // eslint-disable-next-line
        console.error(err)
      }

      readStream()
    })
  }
  readStream()
}
</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 12px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtite {
    color: #888;
    font-size: 12px;
  }
}
.preview {
  pre {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .outline-view {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.recommends {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;

  .recommend {
    font-size: 12px;
    background-color: #f1f1f1;
    border-radius: $borderRadius;
    padding: 3px 5px;
    margin-right: 5px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      color: $themeColor;
    }
  }
}
.configs {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;

  .config-item {
    font-size: 13px;
    display: flex;
    align-items: center;
  }
}
.count {
  font-size: 12px;
  color: #999;
  margin-right: 10px;
}
.submit {
  height: 20px;
  font-size: 12px;
  background-color: $themeColor;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    background-color: $themeHoverColor;
  }

  .icon {
    font-size: 15px;
    margin-right: 3px;
  }
}
</style>
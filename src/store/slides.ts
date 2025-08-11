import { defineStore } from 'pinia'
import { omit } from 'lodash'
import type { Slide, SlideTheme, PPTElement, PPTAnimation, SlideTemplate } from '@/types/slides'

interface RemovePropData {
  id: string
  propName: string | string[]
}

interface UpdateElementData {
  id: string | string[]
  props: Partial<PPTElement>
  slideId?: string
}

interface FormatedAnimation {
  animations: PPTAnimation[]
  autoNext: boolean
}

export interface SlidesState {
  title: string
  theme: SlideTheme
  slides: Slide[]
  slideIndex: number
  viewportSize: number
  viewportRatio: number
  templates: SlideTemplate[]
}

export const useSlidesStore = defineStore('slides', {
  state: (): SlidesState => ({
    title: '未命名演示文稿', // 幻灯片标题
    theme: {
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
      fontColor: '#333',
      fontName: '',
      backgroundColor: '#fff',
      shadow: {
        h: 3,
        v: 3,
        blur: 2,
        color: '#808080',
      },
      outline: {
        width: 2,
        color: '#525252',
        style: 'solid',
      },
    }, // 主题样式
    slides: [], // 幻灯片页面数据
    slideIndex: 0, // 当前页面索引
    viewportSize: 1000, // 可视区域宽度基数
    viewportRatio: 0.5625, // 可视区域比例，默认16:9
    templates: [
      { name: '红色通用', id: 'template_1', cover: 'https://asset.pptist.cn/img/template_1.jpg' },
      { name: '蓝色通用', id: 'template_2', cover: 'https://asset.pptist.cn/img/template_2.jpg' },
      { name: '紫色通用', id: 'template_3', cover: 'https://asset.pptist.cn/img/template_3.jpg' },
      { name: '莫兰迪配色', id: 'template_4', cover: 'https://asset.pptist.cn/img/template_4.jpg' },
    ], // 模板
  }),

  getters: {
    currentSlide(state) {
      return state.slides[state.slideIndex]
    },
  
    currentSlideAnimations(state) {
      const currentSlide = state.slides[state.slideIndex]
      if (!currentSlide?.animations) return []

      const els = currentSlide.elements
      const elIds = els.map(el => el.id)
      return currentSlide.animations.filter(animation => elIds.includes(animation.elId))
    },

    // 格式化的当前页动画
    // 将触发条件为“与上一动画同时”的项目向上合并到序列中的同一位置
    // 为触发条件为“上一动画之后”项目的上一项添加自动向下执行标记
    formatedAnimations(state) {
      const currentSlide = state.slides[state.slideIndex]
      if (!currentSlide?.animations) return []

      const els = currentSlide.elements
      const elIds = els.map(el => el.id)
      const animations = currentSlide.animations.filter(animation => elIds.includes(animation.elId))

      const formatedAnimations: FormatedAnimation[] = []
      for (const animation of animations) {
        if (animation.trigger === 'click' || !formatedAnimations.length) {
          formatedAnimations.push({ animations: [animation], autoNext: false })
        }
        else if (animation.trigger === 'meantime') {
          const last = formatedAnimations[formatedAnimations.length - 1]
          last.animations = last.animations.filter(item => item.elId !== animation.elId)
          last.animations.push(animation)
          formatedAnimations[formatedAnimations.length - 1] = last
        }
        else if (animation.trigger === 'auto') {
          const last = formatedAnimations[formatedAnimations.length - 1]
          last.autoNext = true
          formatedAnimations[formatedAnimations.length - 1] = last
          formatedAnimations.push({ animations: [animation], autoNext: false })
        }
      }
      return formatedAnimations
    },
  },

  actions: {
    setTitle(title: string) {
      if (!title) this.title = '未命名演示文稿'
      else this.title = title
    },

    setTheme(themeProps: Partial<SlideTheme>) {
      this.theme = { ...this.theme, ...themeProps }
    },
  
    setViewportSize(size: number) {
      this.viewportSize = size
    },
  
    setViewportRatio(viewportRatio: number) {
      this.viewportRatio = viewportRatio
    },
  
    setSlides(slides: Slide[]) {
      // 检查并修复重复的幻灯片ID
      const seenIds = new Set<string>()
      const duplicateIds = new Set<string>()
      
      slides.forEach(slide => {
        if (seenIds.has(slide.id)) {
          duplicateIds.add(slide.id)
        } else {
          seenIds.add(slide.id)
        }
      })
      
      if (duplicateIds.size > 0) {
        console.warn('⚠️ 检测到重复的幻灯片ID:', Array.from(duplicateIds))
        console.log('📋 重复ID详情:', slides.map((slide, index) => ({ index, id: slide.id })))
        
        // 为重复的ID生成新的唯一ID
        const processedSlides = slides.map((slide, index) => {
          if (duplicateIds.has(slide.id)) {
            const firstOccurrence = slides.findIndex(s => s.id === slide.id)
            if (index !== firstOccurrence) {
              const newId = `${slide.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              console.log(`🔧 修复重复ID: ${slide.id} -> ${newId} (索引 ${index})`)
              return { ...slide, id: newId }
            }
          }
          return slide
        })
        
        this.slides = processedSlides
      } else {
        this.slides = slides
      }
    },
  
    setTemplates(templates: SlideTemplate[]) {
      this.templates = templates
    },
  
    addSlide(slide: Slide | Slide[]) {
      const slides = Array.isArray(slide) ? slide : [slide]
      for (const slide of slides) {
        if (slide.sectionTag) delete slide.sectionTag
      }

      // 检查新添加的幻灯片是否与现有幻灯片有重复ID
      const existingIds = new Set(this.slides.map(s => s.id))
      const processedSlides = slides.map(slide => {
        if (existingIds.has(slide.id)) {
          const newId = `${slide.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          console.warn(`⚠️ 添加幻灯片时检测到重复ID: ${slide.id} -> ${newId}`)
          return { ...slide, id: newId }
        }
        existingIds.add(slide.id) // 添加到集合中，防止批量添加时内部重复
        return slide
      })

      const addIndex = this.slideIndex + 1
      this.slides.splice(addIndex, 0, ...processedSlides)
      this.slideIndex = addIndex
    },
  
    updateSlide(props: Partial<Slide>, slideId?: string) {
      const slideIndex = slideId ? this.slides.findIndex(item => item.id === slideId) : this.slideIndex
      this.slides[slideIndex] = { ...this.slides[slideIndex], ...props }
    },
  
    removeSlideProps(data: RemovePropData) {
      const { id, propName } = data

      const slides = this.slides.map(slide => {
        return slide.id === id ? omit(slide, propName) : slide
      }) as Slide[]
      this.slides = slides
    },
  
    deleteSlide(slideId: string | string[]) {
      const slidesId = Array.isArray(slideId) ? slideId : [slideId]
      const slides: Slide[] = JSON.parse(JSON.stringify(this.slides))
  
      const deleteSlidesIndex = []
      for (const deletedId of slidesId) {
        const index = slides.findIndex(item => item.id === deletedId)
        deleteSlidesIndex.push(index)

        const deletedSlideSection = slides[index].sectionTag
        if (deletedSlideSection) {
          const handleSlideNext = slides[index + 1]
          if (handleSlideNext && !handleSlideNext.sectionTag) {
            delete slides[index].sectionTag
            slides[index + 1].sectionTag = deletedSlideSection
          }
        }

        slides.splice(index, 1)
      }
      let newIndex = Math.min(...deleteSlidesIndex)
  
      const maxIndex = slides.length - 1
      if (newIndex > maxIndex) newIndex = maxIndex
  
      this.slideIndex = newIndex
      this.slides = slides
    },
  
    updateSlideIndex(index: number) {
      this.slideIndex = index
    },
  
    addElement(element: PPTElement | PPTElement[]) {
      const elements = Array.isArray(element) ? element : [element]
      const currentSlideEls = this.slides[this.slideIndex].elements
      const newEls = [...currentSlideEls, ...elements]
      this.slides[this.slideIndex].elements = newEls
    },

    deleteElement(elementId: string | string[]) {
      const elementIdList = Array.isArray(elementId) ? elementId : [elementId]
      const currentSlideEls = this.slides[this.slideIndex].elements
      const newEls = currentSlideEls.filter(item => !elementIdList.includes(item.id))
      this.slides[this.slideIndex].elements = newEls
    },
  
    updateElement(data: UpdateElementData) {
      const { id, props, slideId } = data
      let slideIndex: number
      
      if (slideId) {
        // 当提供slideId时，需要找到正确的幻灯片索引
        // 由于可能存在重复ID，我们需要更智能的查找策略
        const matchingIndices = this.slides
          .map((slide, index) => ({ slide, index }))
          .filter(item => item.slide.id === slideId)
          .map(item => item.index)
        
        if (matchingIndices.length === 0) {
          console.error('❌ No slide found with ID:', slideId)
          return
        } else if (matchingIndices.length === 1) {
          slideIndex = matchingIndices[0]
        } else {
          // 存在重复ID，优先选择当前slideIndex对应的幻灯片
          console.warn('⚠️ Multiple slides found with same ID:', slideId, 'indices:', matchingIndices)
          if (matchingIndices.includes(this.slideIndex)) {
            slideIndex = this.slideIndex
            console.log('✅ Using current slideIndex:', slideIndex)
          } else {
            // 如果当前slideIndex不在匹配列表中，选择最接近当前索引的
            slideIndex = matchingIndices.reduce((closest, current) => 
              Math.abs(current - this.slideIndex) < Math.abs(closest - this.slideIndex) ? current : closest
            )
            console.log('✅ Using closest slideIndex:', slideIndex)
          }
        }
      } else {
        slideIndex = this.slideIndex
      }
      
      console.log('🔧 updateElement called:', {
        elementId: id,
        slideId,
        slideIndex,
        currentSlideIndex: this.slideIndex,
        totalSlides: this.slides.length,
        slidesList: this.slides.map((slide, index) => ({ index, id: slide.id }))
      })
      
      if (slideIndex < 0 || slideIndex >= this.slides.length) {
        console.error('❌ Invalid slideIndex:', slideIndex)
        return
      }
      
      const slide = this.slides[slideIndex]
      const elements = slide.elements.map(element => {
        if (typeof id === 'string') {
          return element.id === id ? { ...element, ...props } : element
        }
        return id.includes(element.id) ? { ...element, ...props } : element
      })
      this.slides[slideIndex].elements = elements
      
      console.log('✅ Element updated successfully:', {
        slideIndex,
        elementId: id,
        updatedSlideId: slide.id
      })
    },
  
    removeElementProps(data: RemovePropData) {
      const { id, propName } = data
      const propsNames = typeof propName === 'string' ? [propName] : propName
  
      const slideIndex = this.slideIndex
      const slide = this.slides[slideIndex]
      const elements = slide.elements.map(el => {
        return el.id === id ? omit(el, propsNames) : el
      })
      this.slides[slideIndex].elements = (elements as PPTElement[])
    },
  },
})
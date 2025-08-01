import type { Slide } from '@/types/slides'

/**
 * 创建空白幻灯片
 */
export const createBlankSlide = (slideId?: string): Slide => {
  const id = slideId || `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  return {
    id,
    elements: [],
    background: {
      type: 'solid',
      color: '#ffffff'
    }
  }
}

/**
 * 根据AI数据和模板匹配结果创建幻灯片内容
 */
export const createSlideFromAIData = (aiData: any, matchedTemplate: any, slideId: string): Slide => {
  const slide = createBlankSlide(slideId)
  
  try {
    // 根据AI数据类型创建不同的元素
    const elements = []
    
    // 添加标题元素
    if (aiData.title) {
      elements.push({
        type: 'text',
        id: `title_${Date.now()}`,
        left: 100,
        top: 100,
        width: 760,
        height: 80,
        content: `<p style="text-align: center; font-size: 36px; font-weight: bold; color: #2563eb;">${aiData.title}</p>`,
        defaultFontName: '微软雅黑',
        defaultColor: '#2563eb'
      })
    }
    
    // 添加内容元素
    if (aiData.content) {
      elements.push({
        type: 'text',
        id: `content_${Date.now()}`,
        left: 100,
        top: aiData.title ? 200 : 150,
        width: 760,
        height: 300,
        content: `<p style="font-size: 18px; line-height: 1.6; color: #374151;">${aiData.content}</p>`,
        defaultFontName: '微软雅黑',
        defaultColor: '#374151'
      })
    }
    
    // 添加列表项元素
    if (aiData.items && Array.isArray(aiData.items)) {
      let itemTop = aiData.title && aiData.content ? 520 : (aiData.title ? 300 : 200)
      
      aiData.items.forEach((item: any, index: number) => {
        elements.push({
          type: 'text',
          id: `item_${Date.now()}_${index}`,
          left: 120,
          top: itemTop + (index * 50),
          width: 720,
          height: 40,
          content: `<p style="font-size: 16px; color: #4b5563;">• ${typeof item === 'string' ? item : item.text || item.content || ''}</p>`,
          defaultFontName: '微软雅黑',
          defaultColor: '#4b5563'
        })
      })
    }
    
    // 应用模板样式（如果有匹配的模板）
    if (matchedTemplate && matchedTemplate.template) {
      // 根据模板调整样式
      applyTemplateStyles(elements, matchedTemplate.template)
    }
    
    slide.elements = elements
    
    console.log(`✅ 成功创建幻灯片，包含 ${elements.length} 个元素`)
    return slide
    
  } catch (error) {
    console.error('❌ 创建幻灯片失败:', error)
    return slide // 返回空白幻灯片
  }
}

/**
 * 应用模板样式到元素
 */
const applyTemplateStyles = (elements: any[], template: any) => {
  try {
    // 根据模板的视觉风格调整颜色
    if (template.visualStyle) {
      const styleColors = getStyleColors(template.visualStyle)
      
      elements.forEach(element => {
        if (element.type === 'text') {
          if (element.id.startsWith('title_')) {
            element.defaultColor = styleColors.primary
            element.content = element.content.replace(/#2563eb/g, styleColors.primary)
          } else if (element.id.startsWith('content_')) {
            element.defaultColor = styleColors.text
            element.content = element.content.replace(/#374151/g, styleColors.text)
          }
        }
      })
    }
    
    // 根据布局类型调整位置
    if (template.layoutType) {
      adjustElementLayout(elements, template.layoutType)
    }
    
  } catch (error) {
    console.error('❌ 应用模板样式失败:', error)
  }
}

/**
 * 根据风格获取颜色配置
 */
const getStyleColors = (visualStyle: string) => {
  const colorSchemes: Record<string, any> = {
    '儿童友好': {
      primary: '#ff6b6b',
      text: '#2d3748',
      accent: '#4ecdc4'
    },
    '互动游戏': {
      primary: '#9c88ff',
      text: '#2d3748',
      accent: '#feca57'
    },
    '卡通可爱': {
      primary: '#ff9ff3',
      text: '#2d3748',
      accent: '#54a0ff'
    },
    '教育专业': {
      primary: '#2563eb',
      text: '#374151',
      accent: '#059669'
    },
    '启蒙引导': {
      primary: '#f59e0b',
      text: '#374151',
      accent: '#10b981'
    }
  }
  
  return colorSchemes[visualStyle] || colorSchemes['教育专业']
}

/**
 * 根据布局类型调整元素位置
 */
const adjustElementLayout = (elements: any[], layoutType: string) => {
  switch (layoutType) {
    case 'grid':
      // 网格布局：适合多个项目
      adjustGridLayout(elements)
      break
    case 'list':
      // 列表布局：垂直排列
      adjustListLayout(elements)
      break
    case 'title-content':
      // 标题-内容布局：经典的上下结构
      adjustTitleContentLayout(elements)
      break
    default:
      // 标准布局：保持默认
      break
  }
}

const adjustGridLayout = (elements: any[]) => {
  const itemElements = elements.filter(el => el.id.startsWith('item_'))
  const cols = Math.ceil(Math.sqrt(itemElements.length))
  const itemWidth = 300
  const itemHeight = 150
  const startX = 100
  const startY = 300
  
  itemElements.forEach((element, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    element.left = startX + col * (itemWidth + 50)
    element.top = startY + row * (itemHeight + 30)
    element.width = itemWidth
    element.height = itemHeight
  })
}

const adjustListLayout = (elements: any[]) => {
  const itemElements = elements.filter(el => el.id.startsWith('item_'))
  let currentTop = 300
  
  itemElements.forEach(element => {
    element.left = 100
    element.top = currentTop
    element.width = 760
    element.height = 50
    currentTop += 60
  })
}

const adjustTitleContentLayout = (elements: any[]) => {
  const titleElement = elements.find(el => el.id.startsWith('title_'))
  const contentElement = elements.find(el => el.id.startsWith('content_'))
  
  if (titleElement) {
    titleElement.top = 80
    titleElement.height = 100
  }
  
  if (contentElement) {
    contentElement.top = 220
    contentElement.height = 400
  }
}
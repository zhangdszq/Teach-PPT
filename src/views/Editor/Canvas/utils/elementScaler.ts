import { nanoid } from 'nanoid'
import type { PPTElement } from '@/types/slides'

// 缩放HTML内容中的字体大小和其他尺寸
export const scaleHtmlContent = (html: string, ratio: number) => {
  return html
    // 处理 font-size: XXpt 格式
    .replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理 font-size: XXpx 格式
    .replace(/font-size:\s*([\d.]+)px/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理行高
    .replace(/line-height:\s*([\d.]+)px/g, (match, p1) => {
      return `line-height: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    // 处理边距
    .replace(/margin:\s*([\d.]+)px/g, (match, p1) => {
      return `margin: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
    .replace(/padding:\s*([\d.]+)px/g, (match, p1) => {
      return `padding: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
}

// 缩放像素值
export const scalePixelValue = (value: string, ratio: number) => {
  if (!value) return value
  
  const match = value.match(/([\d.]+)px/)
  if (match) {
    return `${(parseFloat(match[1]) * ratio).toFixed(1)}px`
  }
  
  return value
}

// 使用固定视口模式处理元素适配
export const processElementsWithFixedViewport = (
  elements: PPTElement[], 
  slideSize?: { width: number; height: number }
) => {
  if (!slideSize) {
    slideSize = { width: 1280, height: 720 }
  }
  
  // 计算缩放比例，固定视口宽度为 1000px
  const ratio = 1000 / slideSize.width
  
  console.log(`应用固定视口适配: 原始尺寸 ${slideSize.width}x${slideSize.height}, 缩放比例 ${ratio}`)
  
  // 如果已经是标准尺寸（1000px宽度），不需要缩放
  if (Math.abs(slideSize.width - 1000) < 1) {
    console.log('模板已经是标准尺寸，跳过缩放处理')
    return elements.map(element => ({
      ...element,
      id: nanoid(10)
    }))
  }
  
  // 对所有元素应用缩放
  return elements.map(element => {
    const scaledElement = { ...element }
    
    // 为每个元素生成新的 id
    scaledElement.id = nanoid(10)
    
    // 缩放位置和尺寸
    scaledElement.left = element.left * ratio
    scaledElement.top = element.top * ratio
    scaledElement.width = element.width * ratio
    
    // 只有非线条元素才有height属性
    if (element.type !== 'line' && 'height' in element) {
      (scaledElement as any).height = (element as any).height * ratio
    }
    
    // 处理文本元素
    if (element.type === 'text') {
      const textElement = element as any
      const scaledTextElement = scaledElement as any
      if (textElement.content) {
        scaledTextElement.content = scaleHtmlContent(textElement.content, ratio)
      }
      // 处理文本元素的边框
      if (textElement.outline?.width) {
        scaledTextElement.outline = {
          ...textElement.outline,
          width: +(textElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理形状元素
    if (element.type === 'shape') {
      const shapeElement = element as any
      const scaledShapeElement = scaledElement as any
      // 处理形状内的文本
      if (shapeElement.text?.content) {
        scaledShapeElement.text = {
          ...shapeElement.text,
          content: scaleHtmlContent(shapeElement.text.content, ratio)
        }
      }
      // 处理形状边框
      if (shapeElement.outline?.width) {
        scaledShapeElement.outline = {
          ...shapeElement.outline,
          width: +(shapeElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理线条元素
    if (element.type === 'line') {
      const lineElement = element as any
      const scaledLineElement = scaledElement as any
      // 线条的宽度需要缩放
      scaledLineElement.width = +(lineElement.width * ratio).toFixed(2)
      // 处理线条的起点和终点
      if (lineElement.start) {
        scaledLineElement.start = [
          lineElement.start[0] * ratio,
          lineElement.start[1] * ratio
        ]
      }
      if (lineElement.end) {
        scaledLineElement.end = [
          lineElement.end[0] * ratio,
          lineElement.end[1] * ratio
        ]
      }
      // 处理折线的中间点
      if (lineElement.broken2) {
        scaledLineElement.broken2 = [
          lineElement.broken2[0] * ratio,
          lineElement.broken2[1] * ratio
        ]
      }
    }
    
    // 处理图片元素边框
    if (element.type === 'image') {
      const imageElement = element as any
      const scaledImageElement = scaledElement as any
      if (imageElement.outline?.width) {
        scaledImageElement.outline = {
          ...imageElement.outline,
          width: +(imageElement.outline.width * ratio).toFixed(2)
        }
      }
    }
    
    // 处理表格元素
    if (element.type === 'table') {
      const tableElement = element as any
      const scaledTableElement = scaledElement as any
      // 处理表格边框
      if (tableElement.outline?.width) {
        scaledTableElement.outline = {
          ...tableElement.outline,
          width: +(tableElement.outline.width * ratio).toFixed(2)
        }
      }
      // 处理单元格最小高度
      if (tableElement.cellMinHeight) {
        scaledTableElement.cellMinHeight = tableElement.cellMinHeight * ratio
      }
      // 处理表格数据中的字体大小
      if (tableElement.data) {
        scaledTableElement.data = tableElement.data.map((row: any) => 
          row.map((cell: any) => ({
            ...cell,
            style: {
              ...cell.style,
              fontsize: cell.style?.fontsize ? scalePixelValue(cell.style.fontsize, ratio) : cell.style?.fontsize
            }
          }))
        )
      }
    }
    
    // 处理阴影
    const elementWithShadow = element as any
    const scaledElementWithShadow = scaledElement as any
    if (elementWithShadow.shadow) {
      scaledElementWithShadow.shadow = {
        ...elementWithShadow.shadow,
        h: elementWithShadow.shadow.h * ratio,
        v: elementWithShadow.shadow.v * ratio,
        blur: elementWithShadow.shadow.blur * ratio
      }
    }
    
    return scaledElement
  })
}

// 应用固定视口设置
export const applyFixedViewportSettings = (
  slidesStore: any,
  slideSize?: { width: number; height: number }
) => {
  if (!slideSize) {
    slideSize = { width: 1280, height: 720 }
  }
  
  // 设置视口大小为固定的 1000px 宽度
  slidesStore.setViewportSize(1000)
  // 设置视口比例
  slidesStore.setViewportRatio(slideSize.height / slideSize.width)
  
  console.log(`设置固定视口: 宽度 1000px, 比例 ${slideSize.height / slideSize.width}`)
}

// 从元素列表中提取元素需求
export const extractElementRequirements = (elements: PPTElement[]) => {
  const elementCounts: { [key: string]: number } = {}
  
  elements.forEach(element => {
    const type = element.type
    elementCounts[type] = (elementCounts[type] || 0) + 1
  })
  
  return Object.entries(elementCounts).map(([type, count]) => ({
    type,
    count
  }))
}
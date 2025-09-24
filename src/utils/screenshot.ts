/**
 * 统一的截图工具函数
 * 封装html2canvas调用和代理URL处理逻辑，避免代码重复
 */

// 声明全局html2canvas类型
declare global {
  interface Window {
    html2canvas?: any
  }
}

/**
 * 截图配置选项
 */
export interface ScreenshotOptions {
  backgroundColor?: string
  scale?: number
  width?: number
  height?: number
  logging?: boolean
  useCORS?: boolean
  allowTaint?: boolean
  quality?: number
  maxWidth?: number
  maxHeight?: number
}

/**
 * 动态加载html2canvas库
 */
export const loadHtml2Canvas = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.onload = () => {
      console.log('✅ html2canvas库加载成功')
      resolve()
    }
    script.onerror = () => {
      console.error('❌ html2canvas库加载失败')
      reject(new Error('Failed to load html2canvas'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 图片URL代理处理函数
 * 在html2canvas截图前将外部图片URL转换为代理URL
 */
const processImageUrls = (clonedDoc: Document, context: string = '') => {
  const images = clonedDoc.querySelectorAll('img')
  images.forEach((img: HTMLImageElement) => {
    const originalSrc = img.src
    if (originalSrc && (originalSrc.startsWith('http://') || originalSrc.startsWith('https://'))) {
      // 检查是否是外部URL且不是代理URL
      if (!originalSrc.includes('/api/image/proxy') && 
          !originalSrc.includes('localhost') && 
          !originalSrc.includes('127.0.0.1')) {
        const proxyUrl = `${window.location.origin}/api/image/proxy?url=${encodeURIComponent(originalSrc)}`
        console.log(`🔄 ${context} URL重写:`, originalSrc, '->', proxyUrl)
        img.src = proxyUrl
        img.crossOrigin = 'anonymous'
      }
    }
  })
}

/**
 * 压缩图片
 */
const compressImage = (
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number,
  quality: number
): string => {
  const { width: originalWidth, height: originalHeight } = canvas
  
  // 计算缩放比例
  let scale = 1
  if (originalWidth > maxWidth || originalHeight > maxHeight) {
    scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight)
  }
  
  const newWidth = Math.floor(originalWidth * scale)
  const newHeight = Math.floor(originalHeight * scale)
  
  // 如果不需要缩放，直接返回
  if (scale === 1) {
    return canvas.toDataURL('image/jpeg', quality)
  }
  
  // 创建新的canvas进行压缩
  const compressedCanvas = document.createElement('canvas')
  compressedCanvas.width = newWidth
  compressedCanvas.height = newHeight
  
  const ctx = compressedCanvas.getContext('2d')
  if (!ctx) {
    console.warn('⚠️ 无法获取canvas上下文，使用原图')
    return canvas.toDataURL('image/jpeg', quality)
  }
  
  // 绘制压缩后的图片
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)
  
  // 返回压缩后的base64
  const compressedBase64 = compressedCanvas.toDataURL('image/jpeg', quality)
  
  return compressedBase64
}

/**
 * 统一的html2canvas截图函数
 * @param targetElement 目标元素
 * @param options 截图选项
 * @param context 调用上下文，用于日志标识
 * @returns Promise<HTMLCanvasElement | null>
 */
export const captureWithHtml2Canvas = async (
  targetElement: HTMLElement,
  options: ScreenshotOptions = {},
  context: string = 'screenshot'
): Promise<HTMLCanvasElement | null> => {
  const {
    backgroundColor = '#ffffff',
    scale = 2,
    width,
    height,
    logging = false,
    useCORS = true,
    allowTaint = true
  } = options

  try {
    // 确保html2canvas已加载
    if (!window.html2canvas) {
      console.log(`📦 ${context}: 动态加载html2canvas...`)
      await loadHtml2Canvas()
    }

    if (!window.html2canvas) {
      throw new Error('html2canvas加载失败')
    }

    console.log(`🎨 ${context}: 使用html2canvas进行截图...`)
    
    const html2canvasOptions: any = {
      backgroundColor,
      scale,
      useCORS,
      allowTaint,
      logging,
      // 添加URL重写功能，将外部图片URL转换为代理URL
      onclone: (clonedDoc: Document) => {
        processImageUrls(clonedDoc, context)
      }
    }

    // 如果指定了宽高，添加到选项中
    if (width !== undefined) html2canvasOptions.width = width
    if (height !== undefined) html2canvasOptions.height = height

    const canvas = await window.html2canvas(targetElement, html2canvasOptions)
    
    console.log(`✅ ${context}: html2canvas截图成功`)
    return canvas
    
  }
  catch (error) {
    console.warn(`⚠️ ${context}: html2canvas截图失败:`, error)
    return null
  }
}

/**
 * 查找现有的canvas元素作为备选方案
 */
export const findExistingCanvas = (context: string = 'screenshot'): HTMLCanvasElement | null => {
  const canvasElements = document.querySelectorAll('canvas')
  console.log(`🔍 ${context}: 找到canvas元素数量:`, canvasElements.length)

  for (let i = 0; i < canvasElements.length; i++) {
    const canvas = canvasElements[i] as HTMLCanvasElement
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        // 测试是否可以访问canvas数据
        canvas.toDataURL('image/png', 0.1)
        console.log(`✅ ${context}: 使用第${i + 1}个canvas元素`)
        return canvas
      }
      catch (canvasError) {
        console.warn(`⚠️ ${context}: 第${i + 1}个canvas元素不可访问:`, canvasError)
      }
    }
  }

  return null
}

/**
 * 统一的截图函数 - 主入口
 * 包含多种截图方法的完整流程
 */
export const captureScreenshot = async (
  targetElement?: HTMLElement,
  options: ScreenshotOptions = {},
  context: string = 'screenshot'
): Promise<string | null> => {
  const {
    backgroundColor = '#ffffff',
    scale = 2,
    quality = 0.8,
    maxWidth = 800,
    maxHeight = 600
  } = options

  try {
    console.log(`🔍 ${context}: 开始截图...`)
    
    // 如果没有提供目标元素，自动查找
    if (!targetElement) {
      const selectors = [
        '.canvas',
        '.viewport-wrapper',
        '.viewport',
        '.slide-content',
        '.editor-content',
        '[class*="canvas"]',
        '[class*="viewport"]',
        '[class*="slide"]'
      ]
      
      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement
        if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
          targetElement = element
          console.log(`✅ ${context}: 找到可用元素: ${selector}`)
          break
        }
      }
      
      if (!targetElement) {
        console.error(`❌ ${context}: 未找到任何可用的页面元素`)
        targetElement = document.body
        console.log(`🔄 ${context}: 使用body元素作为备选方案`)
      }
    }
    
    let capturedCanvas: HTMLCanvasElement | null = null
    
    // 方法1: 尝试使用html2canvas
    capturedCanvas = await captureWithHtml2Canvas(targetElement, {
      backgroundColor,
      scale,
      width: targetElement.offsetWidth,
      height: targetElement.offsetHeight,
      ...options
    }, context)
    
    // 方法2: 查找现有的canvas元素
    if (!capturedCanvas) {
      capturedCanvas = findExistingCanvas(context)
    }
    
    // 如果获取到了canvas，进行压缩处理
    if (capturedCanvas && capturedCanvas.width > 0 && capturedCanvas.height > 0) {
      const originalSize = Math.round(capturedCanvas.toDataURL('image/png').length / 1024)
      console.log(`📏 ${context}: 原始图片大小: ${originalSize}KB`)
      
      // 压缩图片
      const compressedBase64 = compressImage(capturedCanvas, maxWidth, maxHeight, quality)
      const compressedSize = Math.round(compressedBase64.length / 1024)
      
      console.log(`✅ ${context}: 图片压缩完成: ${originalSize}KB -> ${compressedSize}KB`)
      
      return compressedBase64
    }
    else if (capturedCanvas) {
      console.warn(`⚠️ ${context}: 截图canvas尺寸无效:`, capturedCanvas.width, 'x', capturedCanvas.height)
    }
    
    console.error(`❌ ${context}: 所有截图方法都失败了`)
    return null
    
  }
  catch (error) {
    console.error(`❌ ${context}: 截图过程发生错误:`, error)
    return null
  }
}

/**
 * 专门用于服务器保存的截图函数
 * 包含质量处理逻辑
 */
export const captureForServer = async (
  targetElement?: HTMLElement,
  imageQuality: number = 0.8,
  context: string = 'server-export'
): Promise<string | null> => {
  try {
    console.log(`🔍 ${context}: 开始DOM结构调试...`)

    // 扩展搜索范围，查找所有可能的元素
    const selectors = [
      '.viewport-wrapper',
      '.viewport',
      '.slide-content',
      '.editor-content',
      '[class*="canvas"]',
      '[class*="viewport"]',
      '[class*="slide"]'
    ]

    if (!targetElement) {
      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement
        if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
          targetElement = element
          console.log(`✅ ${context}: 找到可用元素: ${selector}`, {
            width: element.offsetWidth,
            height: element.offsetHeight,
            className: element.className
          })
          break
        }
      }

      if (!targetElement) {
        console.error(`❌ ${context}: 未找到任何可用的页面元素`)
        targetElement = document.body
        console.log(`🔄 ${context}: 使用body元素作为备选方案`)
      }
    }

    let capturedCanvas: HTMLCanvasElement | null = null

    // 方法1: 尝试使用html2canvas
    capturedCanvas = await captureWithHtml2Canvas(targetElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      width: targetElement.offsetWidth,
      height: targetElement.offsetHeight,
      logging: false
    }, context)

    // 方法2: 查找现有的canvas元素
    if (!capturedCanvas) {
      capturedCanvas = findExistingCanvas(context)
    }

    // 如果获取到了canvas，进行质量处理
    if (capturedCanvas) {
      const originalSize = Math.round(capturedCanvas.toDataURL('image/png').length / 1024)
      console.log(`📏 ${context}: 原始图片大小: ${originalSize}KB`)

      // 使用用户设置的图片质量进行处理，保持原始尺寸不压缩
      const processedBase64 = capturedCanvas.toDataURL('image/jpeg', imageQuality)
      const processedSize = Math.round(processedBase64.length / 1024)

      console.log(`✅ ${context}: 图片质量处理完成: ${originalSize}KB -> ${processedSize}KB (质量: ${Math.round(imageQuality * 100)}%)`)

      return processedBase64
    }

    console.error(`❌ ${context}: 所有截图方法都失败了`)
    return null

  }
  catch (error) {
    console.error(`❌ ${context}: 截图过程发生错误:`, error)
    return null
  }
}
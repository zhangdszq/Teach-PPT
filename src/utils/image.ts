interface ImageSize {
  width: number
  height: number
}

/**
 * 获取图片的原始宽高
 * @param src 图片地址
 */
export const getImageSize = (src: string): Promise<ImageSize> => {
  return new Promise(resolve => {
    const img = document.createElement('img')
    img.src = src
    img.style.opacity = '0'
    document.body.appendChild(img)

    img.onload = () => {
      const imgWidth = img.clientWidth
      const imgHeight = img.clientHeight
    
      img.onload = null
      img.onerror = null

      document.body.removeChild(img)

      resolve({ width: imgWidth, height: imgHeight })
    }

    img.onerror = () => {
      img.onload = null
      img.onerror = null
    }
  })
}

/**
 * 读取图片文件的dataURL
 * @param file 图片文件
 */
export const getImageDataURL = (file: File): Promise<string> => {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(reader.result as string)
    })
    reader.readAsDataURL(file)
  })
}

/**
 * 判断是否为SVG代码字符串
 * @param text 待验证文本
 */
export const isSVGString = (text: string): boolean => {
  const svgRegex = /<svg[\s\S]*?>[\s\S]*?<\/svg>/i
  if (!svgRegex.test(text)) return false

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'image/svg+xml')
    return doc.documentElement.nodeName === 'svg'
  } 
  catch {
    return false
  }
}

/**
 * SVG代码转文件
 * @param svg SVG代码
 */
export const svg2File = (svg: string): File => {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return new File([blob], 'image.svg', { type: 'image/svg+xml' })
}

// 声明全局html2canvas类型
declare global {
  interface Window {
    html2canvas?: any
  }
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
 * 压缩图片
 * @param canvas 原始canvas
 * @param maxWidth 最大宽度
 * @param maxHeight 最大高度
 * @param quality 图片质量 (0-1)
 */
export const compressImage = (
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
  
  const newWidth = Math.round(originalWidth * scale)
  const newHeight = Math.round(originalHeight * scale)
  
  // 创建新的canvas进行缩放
  const compressCanvas = document.createElement('canvas')
  compressCanvas.width = newWidth
  compressCanvas.height = newHeight
  
  const ctx = compressCanvas.getContext('2d')
  if (!ctx) {
    return canvas.toDataURL('image/jpeg', quality)
  }
  
  // 绘制缩放后的图片
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)
  
  return compressCanvas.toDataURL('image/jpeg', quality)
}

/**
 * 截图当前页面元素
 * @param targetElement 目标元素，如果不提供则自动查找
 * @param options 截图选项
 */
export const captureElement = async (
  targetElement?: HTMLElement,
  options: {
    backgroundColor?: string
    scale?: number
    maxWidth?: number
    maxHeight?: number
    quality?: number
  } = {}
): Promise<string | null> => {
  const {
    backgroundColor = '#ffffff',
    scale = 1,
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8
  } = options
  
  try {
    console.log('🔍 开始截图...')
    
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
          console.log(`✅ 找到可用元素: ${selector}`)
          break
        }
      }
      
      if (!targetElement) {
        console.error('❌ 未找到任何可用的页面元素')
        targetElement = document.body
        console.log('🔄 使用body元素作为备选方案')
      }
    }
    
    let capturedCanvas: HTMLCanvasElement | null = null
    
    // 方法1: 尝试使用html2canvas（如果可用）
    if (window.html2canvas) {
      console.log('🎨 使用html2canvas进行截图...')
      try {
        capturedCanvas = await window.html2canvas(targetElement, {
          backgroundColor,
          scale,
          useCORS: true,
          allowTaint: true,
          width: targetElement.offsetWidth,
          height: targetElement.offsetHeight,
          logging: false
        })
        
        console.log('✅ html2canvas截图成功')
      } catch (html2canvasError) {
        console.warn('⚠️ html2canvas截图失败:', html2canvasError)
      }
    }
    
    // 方法2: 查找现有的canvas元素
    if (!capturedCanvas) {
      const canvasElements = document.querySelectorAll('canvas')
      console.log('🔍 找到canvas元素数量:', canvasElements.length)
      
      for (let i = 0; i < canvasElements.length; i++) {
        const canvas = canvasElements[i] as HTMLCanvasElement
        if (canvas.width > 0 && canvas.height > 0) {
          try {
            // 测试是否可以访问canvas数据
            canvas.toDataURL('image/png', 0.1)
            capturedCanvas = canvas
            console.log(`✅ 使用第${i + 1}个canvas元素`)
            break
          } catch (canvasError) {
            console.warn(`⚠️ 第${i + 1}个canvas元素不可访问:`, canvasError)
          }
        }
      }
    }
    
    // 方法3: 动态加载html2canvas并重试
    if (!capturedCanvas && !window.html2canvas) {
      console.log('📦 尝试动态加载html2canvas...')
      try {
        await loadHtml2Canvas()
        if (window.html2canvas) {
          capturedCanvas = await window.html2canvas(targetElement, {
            backgroundColor,
            scale,
            useCORS: true,
            allowTaint: true
          })
          console.log('✅ 动态加载html2canvas截图成功')
        }
      } catch (loadError) {
        console.warn('⚠️ 动态加载html2canvas失败:', loadError)
      }
    }
    
    // 如果获取到了canvas，进行压缩处理
    if (capturedCanvas && capturedCanvas.width > 0 && capturedCanvas.height > 0) {
      const originalSize = Math.round(capturedCanvas.toDataURL('image/png').length / 1024)
      console.log(`📏 原始图片大小: ${originalSize}KB`)
      
      // 压缩图片
      const compressedBase64 = compressImage(capturedCanvas, maxWidth, maxHeight, quality)
      const compressedSize = Math.round(compressedBase64.length / 1024)
      
      console.log(`✅ 图片压缩完成: ${originalSize}KB -> ${compressedSize}KB`)
      
      return compressedBase64
    } else if (capturedCanvas) {
      console.warn('⚠️ 截图canvas尺寸无效:', capturedCanvas.width, 'x', capturedCanvas.height)
    }
    
    console.error('❌ 所有截图方法都失败了')
    return null
    
  } catch (error) {
    console.error('❌ 截图过程发生错误:', error)
    return null
  }
}
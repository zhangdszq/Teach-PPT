import { SERVER_URL } from '@/services'
import { captureScreenshot } from './screenshot'

interface ImageSize {
  width: number
  height: number
}

/**
 * 将外部图片URL转换为代理URL，解决CORS问题
 * @param originalUrl 原始图片URL
 * @returns 代理后的URL
 */
export const getProxiedImageUrl = (originalUrl: string): string => {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl
  }
  
  // 如果是本地URL或已经是代理URL，直接返回
  if (originalUrl.startsWith('/') || 
      originalUrl.includes('localhost') || 
      originalUrl.includes('127.0.0.1') ||
      originalUrl.includes('/api/image/proxy')) {
    return originalUrl
  }
  
  // 如果是外部URL，使用代理
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    const proxyUrl = `${SERVER_URL}/api/image/proxy?url=${encodeURIComponent(originalUrl)}`
    console.log('🔄 转换图片URL为代理:', originalUrl, '->', proxyUrl)
    return proxyUrl
  }
  
  return originalUrl
}

/**
 * 批量转换图片URL为代理URL
 * @param urls 图片URL数组
 * @returns 代理后的URL数组
 */
export const getProxiedImageUrls = (urls: string[]): string[] => {
  return urls.map(url => getProxiedImageUrl(url))
}

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
 * 截图当前页面元素 - 使用统一的截图函数
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
  return await captureScreenshot(targetElement, options, 'captureElement')
}
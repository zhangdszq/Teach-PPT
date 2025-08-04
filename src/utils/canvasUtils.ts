/**
 * 画布适配工具函数
 */

import { useSlidesStore } from '@/store/slides'

/**
 * 自动适配画布大小到容器
 * @param containerWidth 容器宽度
 * @param containerHeight 容器高度
 * @param slideWidth 幻灯片原始宽度
 * @param slideHeight 幻灯片原始高度
 */
export const autoFitCanvas = (
  containerWidth: number,
  containerHeight: number,
  slideWidth: number = 1280,
  slideHeight: number = 720
) => {
  const slidesStore = useSlidesStore()
  
  // 计算容器的宽高比
  const containerRatio = containerWidth / containerHeight
  // 计算幻灯片的宽高比
  const slideRatio = slideWidth / slideHeight
  
  let newWidth: number
  let newHeight: number
  
  // 根据宽高比决定适配方式
  if (containerRatio > slideRatio) {
    // 容器更宽，以高度为准
    newHeight = containerHeight * 0.8 // 留出 20% 边距
    newWidth = newHeight * slideRatio
  } else {
    // 容器更高，以宽度为准
    newWidth = containerWidth * 0.8 // 留出 20% 边距
    newHeight = newWidth / slideRatio
  }
  
  // 设置新的视口大小
  slidesStore.setViewportSize(newWidth)
  slidesStore.setViewportRatio(slideHeight / slideWidth)
  
  return {
    width: newWidth,
    height: newHeight,
    ratio: newWidth / slideWidth
  }
}

/**
 * 重置画布到标准大小
 */
export const resetCanvasSize = () => {
  const slidesStore = useSlidesStore()
  
  // 重置为标准 1000px 宽度，16:9 比例
  slidesStore.setViewportSize(1000)
  slidesStore.setViewportRatio(0.5625) // 9/16
}

/**
 * 适配 1280x720 模板到画布
 */
export const fit1280x720Template = () => {
  const slidesStore = useSlidesStore()
  
  // 设置适合 1280x720 的视口大小
  const baseWidth = 1000 // PPTist 标准基准宽度
  const ratio = baseWidth / 1280 // 缩放比例
  
  slidesStore.setViewportSize(baseWidth)
  slidesStore.setViewportRatio(720 / 1280) // 0.5625
  
  return ratio
}
// 课程模板映射工具
export interface CourseSection {
  type: 'lesson' | 'practice' | 'review'
  title: string
  content: string
  pageType: string
  elements?: string[]
}

export interface CourseStructure {
  title: string
  targetAge: string
  objectives: string[]
  lessons: CourseSection[]
}

// 页面类型到模板的映射
export const PAGE_TYPE_TEMPLATE_MAP = {
  // 字母教学页面
  'letter-shape': {
    templateId: 'phonics_letter_intro',
    layout: 'center-focus',
    elements: ['title', 'large-letter', 'visual-elements', 'instruction']
  },
  'letter-sound': {
    templateId: 'phonics_sound_demo',
    layout: 'audio-visual',
    elements: ['title', 'letter', 'sound-symbol', 'audio-button', 'animation']
  },
  'letter-words': {
    templateId: 'vocabulary_showcase',
    layout: 'grid-cards',
    elements: ['title', 'word-cards', 'images', 'phonics-breakdown']
  },
  
  // 练习页面
  'sound-recognition': {
    templateId: 'interactive_quiz',
    layout: 'question-options',
    elements: ['question', 'image-options', 'feedback']
  },
  'phonics-game': {
    templateId: 'drag_drop_game',
    layout: 'game-interface',
    elements: ['instructions', 'draggable-items', 'drop-zones', 'score']
  },
  'matching-game': {
    templateId: 'matching_pairs',
    layout: 'two-column',
    elements: ['left-items', 'right-items', 'connection-lines']
  },
  
  // 复习页面
  'review-game': {
    templateId: 'game_collection',
    layout: 'multi-activity',
    elements: ['game-menu', 'activity-areas', 'progress-bar']
  }
}

// 课程大纲解析器
export class CourseOutlineParser {
  
  // 解析markdown课程大纲
  static parseMarkdownOutline(markdown: string): CourseStructure {
    console.log('🔍 开始解析课程大纲...')
    console.log('📄 原始内容长度:', markdown.length, '字符')
    
    const lines = markdown.split('\n').filter(line => line.trim())
    console.log('📝 有效行数:', lines.length)
    
    const course: CourseStructure = {
      title: '',
      targetAge: '',
      objectives: [],
      lessons: []
    }
    
    let currentSection: CourseSection | null = null
    let lineIndex = 0
    
    for (const line of lines) {
      const trimmed = line.trim()
      lineIndex++
      
      // 解析教学目标
      if (trimmed.includes('教学目标') && trimmed.includes('适合')) {
        const ageMatch = trimmed.match(/适合(\d+-\d+岁)/)
        if (ageMatch) {
          course.targetAge = ageMatch[1]
          console.log(`✅ 第${lineIndex}行 - 解析到适用年龄:`, course.targetAge)
        }
      }
      
      // 解析目标列表
      if (trimmed.startsWith('* ') && !course.title) {
        const objective = trimmed.substring(2)
        course.objectives.push(objective)
        console.log(`✅ 第${lineIndex}行 - 解析到教学目标:`, objective)
      }
      
      // 解析课程标题
      if (trimmed.startsWith('### 🌟 **Lesson')) {
        const lessonMatch = trimmed.match(/Lesson \d+: ([A-Za-z\s]+)/)
        if (lessonMatch) {
          course.title = `英语字母课程 - ${lessonMatch[1]}`
          console.log(`✅ 第${lineIndex}行 - 解析到课程标题:`, course.title)
        }
      }
      
      // 解析教学页面
      if (trimmed.startsWith('#### 📄 教学页面')) {
        const pageMatch = trimmed.match(/教学页面 \d+：(.+)/)
        if (pageMatch) {
          const pageType = this.getPageType(pageMatch[1])
          currentSection = {
            type: 'lesson',
            title: pageMatch[1],
            content: '',
            pageType: pageType
          }
          course.lessons.push(currentSection)
          console.log(`✅ 第${lineIndex}行 - 解析到教学页面:`, {
            title: pageMatch[1],
            type: 'lesson',
            pageType: pageType
          })
        }
      }
      
      // 解析练习页面
      if (trimmed.startsWith('#### 📝 练习页面') || trimmed.startsWith('#### 🧩 练习页面')) {
        const pageMatch = trimmed.match(/练习页面 [A-Z]\d+：(.+)/)
        if (pageMatch) {
          const pageType = this.getPageType(pageMatch[1])
          currentSection = {
            type: 'practice',
            title: pageMatch[1],
            content: '',
            pageType: pageType
          }
          course.lessons.push(currentSection)
          console.log(`✅ 第${lineIndex}行 - 解析到练习页面:`, {
            title: pageMatch[1],
            type: 'practice',
            pageType: pageType
          })
        }
      }
      
      // 解析复习游戏
      if (trimmed.startsWith('## 🎮 复习游戏环节')) {
        currentSection = {
          type: 'review',
          title: '复习游戏环节',
          content: '',
          pageType: 'review-game'
        }
        course.lessons.push(currentSection)
        console.log(`✅ 第${lineIndex}行 - 解析到复习页面:`, {
          title: '复习游戏环节',
          type: 'review',
          pageType: 'review-game'
        })
      }
      
      // 收集内容
      if (currentSection && (trimmed.startsWith('* ') || trimmed.startsWith('> ') || trimmed.includes('：'))) {
        currentSection.content += trimmed + '\n'
        console.log(`📝 第${lineIndex}行 - 为页面"${currentSection.title}"添加内容:`, trimmed.substring(0, 50) + '...')
      }
    }
    
    console.log('🎉 课程大纲解析完成!')
    console.log('📊 解析结果统计:', {
      课程标题: course.title,
      适用年龄: course.targetAge,
      教学目标数量: course.objectives.length,
      课程页面数量: course.lessons.length,
      页面类型分布: {
        教学页面: course.lessons.filter(l => l.type === 'lesson').length,
        练习页面: course.lessons.filter(l => l.type === 'practice').length,
        复习页面: course.lessons.filter(l => l.type === 'review').length
      }
    })
    
    return course
  }
  
  // 根据页面标题确定页面类型
  private static getPageType(title: string): string {
    console.log('🔍 正在识别页面类型:', title)
    
    let pageType = 'general'
    
    if (title.includes('字母形状')) {
      pageType = 'letter-shape'
      console.log('✅ 匹配到页面类型: letter-shape (字母形状教学)')
    } else if (title.includes('字母音')) {
      pageType = 'letter-sound'
      console.log('✅ 匹配到页面类型: letter-sound (字母发音教学)')
    } else if (title.includes('开头单词')) {
      pageType = 'letter-words'
      console.log('✅ 匹配到页面类型: letter-words (单词展示)')
    } else if (title.includes('音辨认')) {
      pageType = 'sound-recognition'
      console.log('✅ 匹配到页面类型: sound-recognition (发音识别练习)')
    } else if (title.includes('拼读游戏')) {
      pageType = 'phonics-game'
      console.log('✅ 匹配到页面类型: phonics-game (拼读游戏)')
    } else if (title.includes('配对游戏')) {
      pageType = 'matching-game'
      console.log('✅ 匹配到页面类型: matching-game (配对游戏)')
    } else if (title.includes('复习游戏')) {
      pageType = 'review-game'
      console.log('✅ 匹配到页面类型: review-game (复习游戏)')
    } else {
      console.log('⚠️ 未匹配到特定类型，使用默认类型: general')
    }
    
    return pageType
  }
}

// PPT生成器
export class PPTGenerator {
  
  // 根据课程结构生成PPT数据
  static generatePPTFromCourse(course: CourseStructure) {
    console.log('🚀 开始生成PPT课件...')
    console.log('📋 课程信息:', {
      标题: course.title,
      适用年龄: course.targetAge,
      教学目标数量: course.objectives.length,
      课程页面数量: course.lessons.length
    })
    
    const slides = []
    
    // 生成封面页
    console.log('📄 正在生成封面页...')
    const coverSlide = this.createCoverSlide(course)
    slides.push(coverSlide)
    console.log('✅ 封面页生成完成, ID:', coverSlide.id)
    
    // 生成目标页
    console.log('📄 正在生成教学目标页...')
    const objectivesSlide = this.createObjectivesSlide(course)
    slides.push(objectivesSlide)
    console.log('✅ 教学目标页生成完成, ID:', objectivesSlide.id, '包含', course.objectives.length, '个目标')
    
    // 为每个课程部分生成幻灯片
    console.log('📄 开始生成课程内容页面...')
    for (let i = 0; i < course.lessons.length; i++) {
      const lesson = course.lessons[i]
      console.log(`📝 正在生成第${i + 1}页:`, {
        标题: lesson.title,
        类型: lesson.type,
        页面类型: lesson.pageType
      })
      
      const slide = this.createLessonSlide(lesson)
      slides.push(slide)
      console.log(`✅ 第${i + 1}页生成完成, ID:`, slide.id)
    }
    
    // 生成总结页
    console.log('📄 正在生成总结页...')
    const summarySlide = this.createSummarySlide(course)
    slides.push(summarySlide)
    console.log('✅ 总结页生成完成, ID:', summarySlide.id)
    
    const pptData = {
      title: course.title,
      width: 960,
      height: 540,
      theme: this.getThemeForCourse(course),
      slides: slides
    }
    
    console.log('🎉 PPT生成完成!')
    console.log('📊 生成结果统计:', {
      总页数: slides.length,
      课件标题: pptData.title,
      画布尺寸: `${pptData.width}x${pptData.height}`,
      主题颜色数量: pptData.theme.themeColors.length
    })
    
    return pptData
  }
  
  // 创建封面幻灯片
  private static createCoverSlide(course: CourseStructure) {
    console.log('🎨 创建封面幻灯片...')
    
    const slideId = `slide_cover_${Date.now()}`
    const titleId = `title_${Date.now()}`
    const subtitleId = `subtitle_${Date.now()}`
    
    console.log('📝 封面元素配置:', {
      幻灯片ID: slideId,
      标题元素ID: titleId,
      副标题元素ID: subtitleId,
      标题内容: course.title,
      适用年龄: course.targetAge
    })
    
    const slide = {
      id: slideId,
      elements: [
        {
          type: 'text',
          id: titleId,
          left: 100,
          top: 200,
          width: 760,
          height: 100,
          content: `<p style="text-align: center; font-size: 48px; font-weight: bold; color: #2563eb;">${course.title}</p>`,
          defaultFontName: '微软雅黑',
          defaultColor: '#2563eb'
        },
        {
          type: 'text',
          id: subtitleId,
          left: 100,
          top: 320,
          width: 760,
          height: 60,
          content: `<p style="text-align: center; font-size: 24px; color: #64748b;">适合年龄：${course.targetAge}</p>`,
          defaultFontName: '微软雅黑',
          defaultColor: '#64748b'
        }
      ],
      background: {
        type: 'solid',
        color: '#f8fafc'
      }
    }
    
    console.log('✅ 封面幻灯片创建完成')
    return slide
  }
  
  // 创建教学目标幻灯片
  private static createObjectivesSlide(course: CourseStructure) {
    const objectiveElements = course.objectives.map((objective, index) => ({
      type: 'text',
      id: `objective_${index}_${Date.now()}`,
      left: 120,
      top: 150 + index * 60,
      width: 720,
      height: 50,
      content: `<p style="font-size: 20px; color: #374151;">• ${objective}</p>`,
      defaultFontName: '微软雅黑',
      defaultColor: '#374151'
    }))
    
    return {
      id: `slide_objectives_${Date.now()}`,
      elements: [
        {
          type: 'text',
          id: `objectives_title_${Date.now()}`,
          left: 100,
          top: 80,
          width: 760,
          height: 60,
          content: '<p style="text-align: center; font-size: 36px; font-weight: bold; color: #1f2937;">🧠 教学目标</p>',
          defaultFontName: '微软雅黑',
          defaultColor: '#1f2937'
        },
        ...objectiveElements
      ],
      background: {
        type: 'solid',
        color: '#ffffff'
      }
    }
  }
  
  // 创建课程内容幻灯片
  private static createLessonSlide(lesson: CourseSection) {
    console.log('🎨 创建课程内容幻灯片:', lesson.title)
    console.log('🔍 页面类型:', lesson.pageType)
    
    // 模板匹配
    const template = PAGE_TYPE_TEMPLATE_MAP[lesson.pageType]
    if (template) {
      console.log('✅ 找到匹配的模板:', {
        模板ID: template.templateId,
        布局类型: template.layout,
        包含元素: template.elements
      })
    } else {
      console.log('⚠️ 未找到匹配的模板，使用默认模板')
    }
    
    const slideId = `slide_${lesson.type}_${Date.now()}`
    const titleId = `lesson_title_${Date.now()}`
    const contentId = `lesson_content_${Date.now()}`
    const backgroundColor = this.getBackgroundForType(lesson.type)
    
    console.log('📝 幻灯片元素配置:', {
      幻灯片ID: slideId,
      标题元素ID: titleId,
      内容元素ID: contentId,
      背景颜色: backgroundColor,
      内容长度: lesson.content.length + '字符'
    })
    
    // 格式化内容
    const formattedContent = this.formatContent(lesson.content)
    console.log('🎨 内容格式化完成，处理后长度:', formattedContent.length + '字符')
    
    const slide = {
      id: slideId,
      elements: [
        {
          type: 'text',
          id: titleId,
          left: 100,
          top: 60,
          width: 760,
          height: 80,
          content: `<p style="text-align: center; font-size: 32px; font-weight: bold; color: #059669;">${lesson.title}</p>`,
          defaultFontName: '微软雅黑',
          defaultColor: '#059669'
        },
        {
          type: 'text',
          id: contentId,
          left: 100,
          top: 160,
          width: 760,
          height: 300,
          content: `<div style="font-size: 18px; line-height: 1.6; color: #374151;">${formattedContent}</div>`,
          defaultFontName: '微软雅黑',
          defaultColor: '#374151'
        }
      ],
      background: {
        type: 'solid',
        color: backgroundColor
      }
    }
    
    console.log('✅ 课程内容幻灯片创建完成')
    return slide
  }
  
  // 创建总结幻灯片
  private static createSummarySlide(course: CourseStructure) {
    return {
      id: `slide_summary_${Date.now()}`,
      elements: [
        {
          type: 'text',
          id: `summary_title_${Date.now()}`,
          left: 100,
          top: 200,
          width: 760,
          height: 100,
          content: '<p style="text-align: center; font-size: 48px; font-weight: bold; color: #dc2626;">🎉 课程完成！</p>',
          defaultFontName: '微软雅黑',
          defaultColor: '#dc2626'
        },
        {
          type: 'text',
          id: `summary_content_${Date.now()}`,
          left: 100,
          top: 320,
          width: 760,
          height: 60,
          content: '<p style="text-align: center; font-size: 24px; color: #64748b;">恭喜完成英语字母学习！</p>',
          defaultFontName: '微软雅黑',
          defaultColor: '#64748b'
        }
      ],
      background: {
        type: 'solid',
        color: '#fef2f2'
      }
    }
  }
  
  // 格式化内容
  private static formatContent(content: string): string {
    console.log('🎨 开始格式化内容...')
    console.log('📝 原始内容:', content.substring(0, 100) + (content.length > 100 ? '...' : ''))
    
    let formattedContent = content
    
    // 处理粗体文本
    const boldMatches = content.match(/\*\*(.*?)\*\*/g)
    if (boldMatches) {
      console.log('✅ 发现粗体文本:', boldMatches.length + '处')
      formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    }
    
    // 处理斜体文本
    const italicMatches = content.match(/\*(.*?)\*/g)
    if (italicMatches) {
      console.log('✅ 发现斜体文本:', italicMatches.length + '处')
      formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>')
    }
    
    // 处理换行
    const lineBreaks = (content.match(/\n/g) || []).length
    if (lineBreaks > 0) {
      console.log('✅ 处理换行符:', lineBreaks + '个')
      formattedContent = formattedContent.replace(/\n/g, '<br>')
    }
    
    // 处理引用块
    const quoteMatches = content.match(/> (.*?)(\n|$)/g)
    if (quoteMatches) {
      console.log('✅ 发现引用块:', quoteMatches.length + '个')
      formattedContent = formattedContent.replace(/> (.*?)(<br>|$)/g, '<blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #1e40af;">$1</blockquote>')
    }
    
    console.log('✅ 内容格式化完成')
    return formattedContent
  }
  
  // 根据课程类型获取主题
  private static getThemeForCourse(course: CourseStructure) {
    return {
      backgroundColor: '#ffffff',
      themeColors: [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
      ],
      fontColor: '#1f2937',
      fontName: '微软雅黑',
      outline: {
        color: '#e5e7eb',
        width: 1,
        style: 'solid'
      }
    }
  }
  
  // 根据类型获取背景色
  private static getBackgroundForType(type: string): string {
    console.log('🎨 为页面类型选择背景色:', type)
    
    let backgroundColor: string
    switch (type) {
      case 'lesson':
        backgroundColor = '#f0f9ff'
        console.log('✅ 教学页面 - 使用蓝色背景:', backgroundColor)
        break
      case 'practice':
        backgroundColor = '#f0fdf4'
        console.log('✅ 练习页面 - 使用绿色背景:', backgroundColor)
        break
      case 'review':
        backgroundColor = '#fef3c7'
        console.log('✅ 复习页面 - 使用黄色背景:', backgroundColor)
        break
      default:
        backgroundColor = '#ffffff'
        console.log('✅ 默认页面 - 使用白色背景:', backgroundColor)
        break
    }
    
    return backgroundColor
  }
}
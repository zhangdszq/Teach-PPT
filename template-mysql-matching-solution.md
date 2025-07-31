# PPT模板精确特征匹配方案 - MySQL数据库实现

## 🎯 方案概述

基于MySQL数据库实现PPT模板的精确特征匹配，通过结构化数据存储和SQL查询，实现对模板数量、布局、元素类型等精确特征的匹配。

## 📚 课程大纲与模板匹配统一结构

### 1. 课程大纲标准化结构

基于您提供的课程大纲示例，我们定义统一的课程结构：

```json
{
  "courseOutline": {
    "courseInfo": {
      "title": "字母形状教学",
      "targetAge": "3-6岁",
      "subject": "English",
      "gradeLevel": "幼儿园-小学",
      "totalLessons": 3,
      "estimatedDuration": "每课5-10分钟"
    },
    "teachingObjectives": [
      "认识字母 A/B/C 的大写与小写",
      "学会字母发音：/æ/、/b/、/k/",
      "理解发音与单词之间的联系",
      "初步进行字母音拼读"
    ],
    "lessons": [
      {
        "lessonId": "lesson_a",
        "lessonTitle": "Lesson 1: A a",
        "pages": [
          {
            "pageId": "page_a_1",
            "pageTitle": "字母形状",
            "pageType": "teaching",
            "contentStructure": {
              "mainElements": [
                {
                  "type": "title",
                  "count": 1,
                  "content": "字母形状"
                },
                {
                  "type": "letter_display",
                  "count": 2,
                  "content": "A a",
                  "description": "展示大写和小写"
                },
                {
                  "type": "visual_scene",
                  "count": 2,
                  "content": ["苹果树上挂着A", "蚂蚁爬过A造型"],
                  "description": "形象化场景"
                },
                {
                  "type": "instruction_text",
                  "count": 1,
                  "content": "This is A. Big A, small a.",
                  "description": "英文指导语"
                }
              ],
              "layoutType": "三段式布局",
              "visualStyle": "卡通插画风格",
              "interactionType": "观察学习"
            },
            "teachingFeatures": {
              "learningMethod": "视觉联想记忆",
              "skillFocus": "字母识别",
              "languageSkills": ["字母认知", "形状识别", "大小写区分"]
            }
          },
          {
            "pageId": "page_a_2",
            "pageTitle": "字母音",
            "pageType": "teaching",
            "contentStructure": {
              "mainElements": [
                {
                  "type": "title",
                  "count": 1,
                  "content": "字母音"
                },
                {
                  "type": "audio_demo",
                  "count": 1,
                  "content": "A says /æ/, /æ/, /æ/",
                  "description": "语音演示"
                },
                {
                  "type": "animation",
                  "count": 1,
                  "content": "老师指着A，小动物重复发音",
                  "description": "音频动画"
                }
              ],
              "layoutType": "双栏布局",
              "visualStyle": "动画互动风格",
              "interactionType": "听说练习"
            }
          },
          {
            "pageId": "page_a_3",
            "pageTitle": "字母A开头单词",
            "pageType": "teaching",
            "contentStructure": {
              "mainElements": [
                {
                  "type": "title",
                  "count": 1,
                  "content": "字母A开头单词"
                },
                {
                  "type": "vocab_item",
                  "count": 3,
                  "content": ["Apple", "Ant", "Alligator"],
                  "description": "A开头单词图卡"
                },
                {
                  "type": "phonics_practice",
                  "count": 1,
                  "content": "/æ/ - p - l (apple)",
                  "description": "读音练习"
                }
              ],
              "layoutType": "网格布局",
              "visualStyle": "图卡展示风格",
              "interactionType": "跟读练习"
            }
          }
        ],
        "practicePages": [
          {
            "pageId": "practice_a_1",
            "pageTitle": "字母音辨认",
            "pageType": "practice",
            "contentStructure": {
              "mainElements": [
                {
                  "type": "question_text",
                  "count": 1,
                  "content": "What's the sound?"
                },
                {
                  "type": "option_image",
                  "count": 3,
                  "content": ["apple 🍎", "ball ⚽", "cat 🐱"],
                  "description": "选择题图片"
                },
                {
                  "type": "instruction",
                  "count": 1,
                  "content": "让孩子指出哪个是 /æ/"
                }
              ],
              "layoutType": "选择题布局",
              "visualStyle": "互动游戏风格",
              "interactionType": "点击选择"
            }
          },
          {
            "pageId": "practice_a_2",
            "pageTitle": "拼读游戏",
            "pageType": "practice",
            "contentStructure": {
              "mainElements": [
                {
                  "type": "game_instruction",
                  "count": 1,
                  "content": "Drag the letter to make the word"
                },
                {
                  "type": "letter_tile",
                  "count": 5,
                  "content": ["a", "p", "p", "l", "e"],
                  "description": "可拖动字母"
                },
                {
                  "type": "target_image",
                  "count": 1,
                  "content": "苹果图片",
                  "description": "目标单词图片"
                }
              ],
              "layoutType": "游戏布局",
              "visualStyle": "拖拽游戏风格",
              "interactionType": "拖拽操作"
            }
          }
        ]
      }
    ]
  }
}
```

### 2. 模板匹配映射规则

基于课程大纲结构，建立模板匹配的映射关系：

#### 2.1 页面类型映射

```javascript
const pageTypeMapping = {
  "teaching": {
    "templateCategory": "教学页面",
    "interactionLevel": "观察学习",
    "complexity": "基础"
  },
  "practice": {
    "templateCategory": "练习页面", 
    "interactionLevel": "互动练习",
    "complexity": "进阶"
  },
  "game": {
    "templateCategory": "游戏页面",
    "interactionLevel": "游戏互动", 
    "complexity": "高级"
  }
};
```

#### 2.2 元素类型标准化

```javascript
const elementTypeStandardization = {
  // 教学元素
  "title": "标题",
  "letter_display": "字母展示", 
  "visual_scene": "视觉场景",
  "instruction_text": "指导文本",
  "audio_demo": "音频演示",
  "animation": "动画元素",
  
  // 词汇元素
  "vocab_item": "词汇项",
  "phonics_practice": "拼读练习",
  "word_card": "单词卡片",
  
  // 练习元素
  "question_text": "问题文本",
  "option_image": "选项图片", 
  "instruction": "操作指导",
  "game_instruction": "游戏说明",
  "letter_tile": "字母拼块",
  "target_image": "目标图片",
  
  // 句型元素
  "sentence_frame": "句型框架",
  "fill_blank": "填空题",
  "dialogue": "对话框"
};
```

#### 2.3 布局类型映射

```javascript
const layoutTypeMapping = {
  "三段式布局": {
    "description": "标题-内容-总结的三段式结构",
    "suitableFor": ["教学页面", "内容展示"],
    "elementArrangement": "vertical"
  },
  "双栏布局": {
    "description": "左右两栏并列布局",
    "suitableFor": ["对比展示", "图文并茂"],
    "elementArrangement": "horizontal"
  },
  "网格布局": {
    "description": "多个元素网格排列",
    "suitableFor": ["词汇展示", "选择题"],
    "elementArrangement": "grid"
  },
  "选择题布局": {
    "description": "问题+选项的标准布局",
    "suitableFor": ["练习页面", "测试题"],
    "elementArrangement": "question_options"
  },
  "游戏布局": {
    "description": "互动游戏专用布局",
    "suitableFor": ["拖拽游戏", "点击游戏"],
    "elementArrangement": "interactive"
  }
};
```

### 3. 统一匹配算法

#### 3.1 课程大纲解析器

```javascript
class CourseOutlineParser {
  constructor() {
    this.elementTypeMap = elementTypeStandardization;
    this.layoutTypeMap = layoutTypeMapping;
  }

  parseOutlineToSearchCriteria(courseOutline) {
    const searchCriteria = [];
    
    for (const lesson of courseOutline.lessons) {
      // 解析教学页面
      for (const page of lesson.pages) {
        const criteria = this.parsePageToCriteria(page, courseOutline.courseInfo);
        searchCriteria.push(criteria);
      }
      
      // 解析练习页面
      if (lesson.practicePages) {
        for (const page of lesson.practicePages) {
          const criteria = this.parsePageToCriteria(page, courseOutline.courseInfo);
          searchCriteria.push(criteria);
        }
      }
    }
    
    return searchCriteria;
  }

  parsePageToCriteria(page, courseInfo) {
    const elementRequirements = page.contentStructure.mainElements.map(element => ({
      type: element.type,
      count: element.count,
      description: element.description || element.content
    }));

    return {
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      pageType: page.pageType,
      elementRequirements,
      subject: courseInfo.subject,
      gradeLevel: courseInfo.gradeLevel,
      layoutType: page.contentStructure.layoutType,
      visualStyle: page.contentStructure.visualStyle,
      interactionType: page.contentStructure.interactionType,
      teachingPurpose: page.teachingFeatures?.skillFocus,
      tags: this.generateTagsFromPage(page),
      estimatedDuration: courseInfo.estimatedDuration
    };
  }

  generateTagsFromPage(page) {
    const tags = [];
    
    // 基于页面类型生成标签
    if (page.pageType === 'teaching') {
      tags.push('教学页面');
    } else if (page.pageType === 'practice') {
      tags.push('练习页面');
    }
    
    // 基于元素类型生成标签
    const elementTypes = page.contentStructure.mainElements.map(el => el.type);
    if (elementTypes.includes('letter_display')) {
      tags.push('字母教学');
    }
    if (elementTypes.includes('vocab_item')) {
      tags.push('词汇学习');
    }
    if (elementTypes.includes('phonics_practice')) {
      tags.push('自然拼读');
    }
    
    // 基于交互类型生成标签
    if (page.contentStructure.interactionType) {
      tags.push(page.contentStructure.interactionType);
    }
    
    return tags;
  }
}
```

#### 3.2 批量模板匹配

```javascript
class BatchTemplateMatching {
  constructor(matchingEngine, outlineParser) {
    this.matchingEngine = matchingEngine;
    this.outlineParser = outlineParser;
  }

  async matchCourseOutline(courseOutline) {
    // 解析课程大纲为搜索条件
    const searchCriteriaList = this.outlineParser.parseOutlineToSearchCriteria(courseOutline);
    
    const matchingResults = [];
    
    for (const criteria of searchCriteriaList) {
      console.log(`🔍 匹配页面: ${criteria.pageTitle}`);
      
      // 为每个页面查找匹配的模板
      const templates = await this.matchingEngine.findMatchingTemplates(criteria);
      
      matchingResults.push({
        pageInfo: {
          pageId: criteria.pageId,
          pageTitle: criteria.pageTitle,
          pageType: criteria.pageType
        },
        searchCriteria: criteria,
        matchedTemplates: templates.slice(0, 3), // 取前3个最匹配的模板
        matchingSummary: {
          totalFound: templates.length,
          bestScore: templates.length > 0 ? templates[0].score : 0,
          hasExactMatch: templates.some(t => t.score >= 90)
        }
      });
    }
    
    return {
      courseInfo: courseOutline.courseInfo,
      totalPages: searchCriteriaList.length,
      matchingResults,
      overallSummary: this.generateOverallSummary(matchingResults)
    };
  }

  generateOverallSummary(results) {
    const totalPages = results.length;
    const pagesWithMatches = results.filter(r => r.matchedTemplates.length > 0).length;
    const pagesWithExactMatches = results.filter(r => r.matchingSummary.hasExactMatch).length;
    const averageScore = results.reduce((sum, r) => sum + r.matchingSummary.bestScore, 0) / totalPages;

    return {
      totalPages,
      pagesWithMatches,
      pagesWithExactMatches,
      matchingRate: (pagesWithMatches / totalPages * 100).toFixed(1) + '%',
      exactMatchingRate: (pagesWithExactMatches / totalPages * 100).toFixed(1) + '%',
      averageScore: averageScore.toFixed(1)
    };
  }
}
```

### 4. 使用示例

#### 4.1 完整匹配流程

```javascript
// 1. 初始化匹配引擎
const matchingEngine = new TemplateMatchingEngine(mysqlConnection);
const outlineParser = new CourseOutlineParser();
const batchMatching = new BatchTemplateMatching(matchingEngine, outlineParser);

// 2. 输入课程大纲
const courseOutline = {
  courseInfo: {
    title: "字母形状教学",
    targetAge: "3-6岁",
    subject: "English",
    gradeLevel: "小学",
    totalLessons: 1,
    estimatedDuration: "5-10分钟"
  },
  lessons: [
    {
      lessonId: "lesson_a",
      lessonTitle: "Lesson 1: A a",
      pages: [
        {
          pageId: "page_a_1",
          pageTitle: "字母形状",
          pageType: "teaching",
          contentStructure: {
            mainElements: [
              { type: "title", count: 1, content: "字母形状" },
              { type: "letter_display", count: 2, content: "A a" },
              { type: "visual_scene", count: 2, content: ["苹果树上挂着A", "蚂蚁爬过A造型"] },
              { type: "instruction_text", count: 1, content: "This is A. Big A, small a." }
            ],
            layoutType: "三段式布局",
            visualStyle: "卡通插画风格",
            interactionType: "观察学习"
          }
        }
      ]
    }
  ]
};

// 3. 执行匹配
const matchingResults = await batchMatching.matchCourseOutline(courseOutline);

// 4. 输出结果
console.log('📊 匹配结果总览:', matchingResults.overallSummary);
console.log('📋 详细匹配结果:', matchingResults.matchingResults);
```

#### 4.2 API接口实现

```javascript
// POST /api/course-outline/match-templates
app.post('/api/course-outline/match-templates', async (req, res) => {
  try {
    const { courseOutline } = req.body;
    
    if (!courseOutline || !courseOutline.lessons) {
      return res.status(400).json({
        status: 'error',
        message: '请提供有效的课程大纲'
      });
    }

    const matchingEngine = new TemplateMatchingEngine(mysqlConnection);
    const outlineParser = new CourseOutlineParser();
    const batchMatching = new BatchTemplateMatching(matchingEngine, outlineParser);

    const results = await batchMatching.matchCourseOutline(courseOutline);

    res.json({
      status: 'success',
      data: results,
      message: `成功匹配 ${results.totalPages} 个页面，找到 ${results.overallSummary.pagesWithMatches} 个页面的匹配模板`
    });

  } catch (error) {
    console.error('课程大纲模板匹配失败:', error);
    res.status(500).json({
      status: 'error',
      message: '模板匹配失败',
      error: error.message
    });
  }
});
```

## 📊 数据库设计

### 1. 模板基础信息表 (templates)

```sql
CREATE TABLE templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    subject VARCHAR(50),
    grade_level VARCHAR(50),
    layout_type VARCHAR(100),
    visual_style VARCHAR(100),
    teaching_purpose TEXT,
    difficulty_level ENUM('入门级', '基础级', '进阶级', '高级'),
    estimated_duration VARCHAR(50),
    template_category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_subject (subject),
    INDEX idx_grade (grade_level),
    INDEX idx_category (template_category),
    INDEX idx_difficulty (difficulty_level)
);
```

### 2. 模板元素表 (template_elements)

```sql
CREATE TABLE template_elements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id VARCHAR(50) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    element_count INT NOT NULL DEFAULT 1,
    element_description TEXT,
    position_info JSON,
    
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
    INDEX idx_template_element (template_id, element_type),
    INDEX idx_element_type (element_type)
);
```

### 3. 模板标签表 (template_tags)

```sql
CREATE TABLE template_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id VARCHAR(50) NOT NULL,
    tag VARCHAR(50) NOT NULL,
    
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
    UNIQUE KEY unique_template_tag (template_id, tag),
    INDEX idx_tag (tag)
);
```

### 4. 内容结构表 (template_content_structure)

```sql
CREATE TABLE template_content_structure (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id VARCHAR(50) NOT NULL,
    main_focus VARCHAR(200),
    visual_elements JSON,
    text_elements JSON,
    interaction_type VARCHAR(100),
    
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
);
```

### 5. 教学特征表 (template_pedagogical_features)

```sql
CREATE TABLE template_pedagogical_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id VARCHAR(50) NOT NULL,
    learning_method VARCHAR(100),
    skill_focus VARCHAR(100),
    age_appropriate VARCHAR(100),
    language_skills JSON,
    
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
);
```

## 🔍 精确匹配查询策略

### 1. 基于元素数量的精确匹配

```sql
-- 查找包含特定数量词汇项和句型框架的模板
SELECT DISTINCT t.* 
FROM templates t
JOIN template_elements te1 ON t.template_id = te1.template_id
JOIN template_elements te2 ON t.template_id = te2.template_id
WHERE te1.element_type = 'vocab_item' AND te1.element_count = 5
  AND te2.element_type = 'sentence_frame' AND te2.element_count = 2;
```

### 2. 基于布局结构的匹配

```sql
-- 查找三段式布局的英语教学模板
SELECT t.*, 
       GROUP_CONCAT(DISTINCT tt.tag) as tags,
       GROUP_CONCAT(DISTINCT CONCAT(te.element_type, ':', te.element_count)) as elements
FROM templates t
LEFT JOIN template_tags tt ON t.template_id = tt.template_id
LEFT JOIN template_elements te ON t.template_id = te.template_id
WHERE t.layout_type = '三段式布局' 
  AND t.subject = 'English'
GROUP BY t.template_id;
```

### 3. 复合条件精确匹配

```sql
-- 复杂查询：查找符合多个精确条件的模板
SELECT t.*,
       COUNT(DISTINCT te.element_type) as element_types_count,
       SUM(te.element_count) as total_elements
FROM templates t
JOIN template_elements te ON t.template_id = te.template_id
JOIN template_tags tt ON t.template_id = tt.template_id
WHERE t.subject = 'English'
  AND t.grade_level = '小学'
  AND tt.tag IN ('字母教学', '自然拼读')
  AND te.element_type IN ('letter_display', 'visual_scene', 'instruction_text')
GROUP BY t.template_id
HAVING element_types_count >= 3;
```

## 🎨 匹配算法实现

### 1. 精确匹配评分系统

```javascript
class TemplateMatchingEngine {
    constructor(mysqlConnection) {
        this.db = mysqlConnection;
    }

    async findMatchingTemplates(searchCriteria) {
        const {
            elementRequirements,  // [{ type: 'vocab_item', count: 5 }, { type: 'sentence_frame', count: 2 }]
            subject,
            gradeLevel,
            layoutType,
            tags,
            teachingPurpose
        } = searchCriteria;

        let query = `
            SELECT DISTINCT t.*,
                   GROUP_CONCAT(DISTINCT CONCAT(te.element_type, ':', te.element_count)) as elements,
                   GROUP_CONCAT(DISTINCT tt.tag) as tags
            FROM templates t
            LEFT JOIN template_elements te ON t.template_id = te.template_id
            LEFT JOIN template_tags tt ON t.template_id = tt.template_id
            WHERE 1=1
        `;

        const params = [];

        // 添加基础条件
        if (subject) {
            query += ` AND t.subject = ?`;
            params.push(subject);
        }

        if (gradeLevel) {
            query += ` AND t.grade_level = ?`;
            params.push(gradeLevel);
        }

        if (layoutType) {
            query += ` AND t.layout_type = ?`;
            params.push(layoutType);
        }

        query += ` GROUP BY t.template_id`;

        const templates = await this.db.query(query, params);

        // 对每个模板进行精确匹配评分
        const scoredTemplates = await Promise.all(
            templates.map(template => this.calculateMatchScore(template, searchCriteria))
        );

        // 按匹配分数排序
        return scoredTemplates
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);
    }

    async calculateMatchScore(template, criteria) {
        let score = 0;
        const maxScore = 100;

        // 1. 元素精确匹配 (40分)
        if (criteria.elementRequirements) {
            const elementScore = await this.calculateElementScore(template.template_id, criteria.elementRequirements);
            score += elementScore * 0.4;
        }

        // 2. 标签匹配 (20分)
        if (criteria.tags) {
            const tagScore = this.calculateTagScore(template.tags, criteria.tags);
            score += tagScore * 0.2;
        }

        // 3. 教学目的匹配 (20分)
        if (criteria.teachingPurpose) {
            const purposeScore = this.calculatePurposeScore(template.teaching_purpose, criteria.teachingPurpose);
            score += purposeScore * 0.2;
        }

        // 4. 布局匹配 (20分)
        if (criteria.layoutType && template.layout_type === criteria.layoutType) {
            score += 20;
        }

        return {
            template,
            score: Math.round(score),
            matchDetails: {
                elementMatch: await this.getElementMatchDetails(template.template_id, criteria.elementRequirements),
                tagMatch: this.getTagMatchDetails(template.tags, criteria.tags),
                layoutMatch: template.layout_type === criteria.layoutType
            }
        };
    }

    async calculateElementScore(templateId, requiredElements) {
        const query = `
            SELECT element_type, element_count 
            FROM template_elements 
            WHERE template_id = ?
        `;
        
        const templateElements = await this.db.query(query, [templateId]);
        const elementMap = new Map();
        templateElements.forEach(el => {
            elementMap.set(el.element_type, el.element_count);
        });

        let matchedElements = 0;
        let totalRequired = requiredElements.length;

        for (const required of requiredElements) {
            const templateCount = elementMap.get(required.type) || 0;
            
            // 精确匹配：数量完全相同得满分，差异越大分数越低
            if (templateCount === required.count) {
                matchedElements += 1;
            } else if (templateCount > 0) {
                // 部分匹配：根据数量差异给分
                const difference = Math.abs(templateCount - required.count);
                const maxDifference = Math.max(templateCount, required.count);
                const partialScore = Math.max(0, 1 - (difference / maxDifference));
                matchedElements += partialScore;
            }
        }

        return totalRequired > 0 ? (matchedElements / totalRequired) * 100 : 0;
    }

    calculateTagScore(templateTags, requiredTags) {
        if (!templateTags || !requiredTags) return 0;
        
        const templateTagSet = new Set(templateTags.split(','));
        const requiredTagSet = new Set(requiredTags);
        
        const intersection = new Set([...requiredTagSet].filter(tag => templateTagSet.has(tag)));
        return (intersection.size / requiredTags.length) * 100;
    }

    calculatePurposeScore(templatePurpose, requiredPurpose) {
        if (!templatePurpose || !requiredPurpose) return 0;
        
        // 使用关键词匹配
        const templateWords = templatePurpose.toLowerCase().split(/\s+/);
        const requiredWords = requiredPurpose.toLowerCase().split(/\s+/);
        
        const matchedWords = requiredWords.filter(word => 
            templateWords.some(tWord => tWord.includes(word) || word.includes(tWord))
        );
        
        return (matchedWords.length / requiredWords.length) * 100;
    }
}
```

## 📝 数据插入示例

### 1. 插入字母形状教学模板

```sql
-- 插入基础模板信息
INSERT INTO templates (
    template_id, name, description, subject, grade_level, 
    layout_type, visual_style, teaching_purpose, difficulty_level, 
    estimated_duration, template_category
) VALUES (
    'template_letter_shape_a',
    '字母形状教学模板 - A',
    '用于教授字母A形状的模板，展示大写和小写字母，配合形象化的视觉元素和指导语',
    'English',
    '小学',
    '三段式布局',
    '卡通插画风格，色彩鲜艳',
    '通过视觉联想帮助学生认识和记忆字母的大小写形状',
    '入门级',
    '5-10分钟',
    '自然拼读基础'
);

-- 插入模板元素
INSERT INTO template_elements (template_id, element_type, element_count, element_description) VALUES
('template_letter_shape_a', 'title', 1, '页面标题：字母形状'),
('template_letter_shape_a', 'letter_display', 2, '大写和小写字母展示：A a'),
('template_letter_shape_a', 'visual_scene', 2, '形象化场景：苹果树上挂着A、蚂蚁爬过A造型'),
('template_letter_shape_a', 'instruction_text', 1, '英文指导语：This is A. Big A, small a.');

-- 插入标签
INSERT INTO template_tags (template_id, tag) VALUES
('template_letter_shape_a', '字母教学'),
('template_letter_shape_a', '自然拼读'),
('template_letter_shape_a', '视觉学习'),
('template_letter_shape_a', '大小写'),
('template_letter_shape_a', '形状认知');

-- 插入内容结构
INSERT INTO template_content_structure (
    template_id, main_focus, visual_elements, text_elements, interaction_type
) VALUES (
    'template_letter_shape_a',
    '字母A的形状认知',
    '["苹果树", "蚂蚁", "字母A造型"]',
    '["大写A", "小写a", "英文指导语"]',
    '观察学习'
);

-- 插入教学特征
INSERT INTO template_pedagogical_features (
    template_id, learning_method, skill_focus, age_appropriate, language_skills
) VALUES (
    'template_letter_shape_a',
    '视觉联想记忆',
    '字母识别',
    '幼儿园-小学低年级',
    '["字母认知", "形状识别", "大小写区分"]'
);
```

## 🔍 查询使用示例

### 1. 查找包含5个词汇项和2个句型框架的模板

```javascript
const searchCriteria = {
    elementRequirements: [
        { type: 'vocab_item', count: 5 },
        { type: 'sentence_frame', count: 2 }
    ],
    subject: 'English',
    gradeLevel: '小学',
    tags: ['词汇学习', '句型练习']
};

const matchingEngine = new TemplateMatchingEngine(mysqlConnection);
const results = await matchingEngine.findMatchingTemplates(searchCriteria);

console.log('匹配结果:', results);
```

### 2. 查找字母教学相关模板

```sql
SELECT t.*, 
       te.element_type,
       te.element_count,
       tt.tag
FROM templates t
JOIN template_elements te ON t.template_id = te.template_id
JOIN template_tags tt ON t.template_id = tt.template_id
WHERE tt.tag IN ('字母教学', '自然拼读', '形状认知')
  AND te.element_type IN ('letter_display', 'visual_scene')
ORDER BY t.template_id, te.element_type;
```

## 🚀 API接口设计

### 1. 模板搜索接口

```javascript
// POST /api/templates/search
app.post('/api/templates/search', async (req, res) => {
    try {
        const searchCriteria = req.body;
        const matchingEngine = new TemplateMatchingEngine(mysqlConnection);
        const results = await matchingEngine.findMatchingTemplates(searchCriteria);
        
        res.json({
            status: 'success',
            data: {
                total: results.length,
                templates: results,
                searchCriteria
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: '模板搜索失败',
            error: error.message
        });
    }
});
```

### 2. 模板详情接口

```javascript
// GET /api/templates/:templateId
app.get('/api/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        
        const query = `
            SELECT t.*,
                   GROUP_CONCAT(DISTINCT CONCAT(te.element_type, ':', te.element_count)) as elements,
                   GROUP_CONCAT(DISTINCT tt.tag) as tags,
                   tcs.main_focus,
                   tcs.visual_elements,
                   tcs.text_elements,
                   tcs.interaction_type,
                   tpf.learning_method,
                   tpf.skill_focus,
                   tpf.language_skills
            FROM templates t
            LEFT JOIN template_elements te ON t.template_id = te.template_id
            LEFT JOIN template_tags tt ON t.template_id = tt.template_id
            LEFT JOIN template_content_structure tcs ON t.template_id = tcs.template_id
            LEFT JOIN template_pedagogical_features tpf ON t.template_id = tpf.template_id
            WHERE t.template_id = ?
            GROUP BY t.template_id
        `;
        
        const [template] = await mysqlConnection.query(query, [templateId]);
        
        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: '模板不存在'
            });
        }
        
        res.json({
            status: 'success',
            data: template
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: '获取模板详情失败',
            error: error.message
        });
    }
});
```

## 📊 性能优化建议

### 1. 索引优化

```sql
-- 复合索引优化查询性能
CREATE INDEX idx_template_search ON templates(subject, grade_level, template_category);
CREATE INDEX idx_element_search ON template_elements(element_type, element_count);
CREATE INDEX idx_tag_search ON template_tags(tag);
```

### 2. 查询缓存

```javascript
const Redis = require('redis');
const redis = Redis.createClient();

class CachedTemplateMatchingEngine extends TemplateMatchingEngine {
    async findMatchingTemplates(searchCriteria) {
        const cacheKey = `template_search:${JSON.stringify(searchCriteria)}`;
        
        // 尝试从缓存获取
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        
        // 执行搜索
        const results = await super.findMatchingTemplates(searchCriteria);
        
        // 缓存结果（5分钟过期）
        await redis.setex(cacheKey, 300, JSON.stringify(results));
        
        return results;
    }
}
```

## 🎯 优势总结

1. **精确匹配**：支持元素数量、类型的精确匹配
2. **灵活查询**：支持复合条件和评分排序
3. **高性能**：通过索引和缓存优化查询性能
4. **可扩展**：易于添加新的匹配维度和评分规则
5. **数据一致性**：通过外键约束保证数据完整性

这个方案能够精确匹配"包含5个词汇项和2个句型框架"这样的具体需求，比向量匹配更适合结构化特征的精确匹配。
# 🎯 AI PPT生成器使用指南

## 📋 功能概述

AI PPT生成器是一个基于人工智能的教学PPT自动生成系统，能够根据课程大纲自动生成适合不同年级学生的教学幻灯片。

## 🚀 核心功能

### 1. 智能内容生成
- 📚 基于课程大纲自动提取教学要点
- 🤖 使用Gemini AI生成适合年龄的教学内容
- 🎯 自动生成学习目标和评估标准

### 2. 模板智能匹配
- 🔍 根据学科和年级自动匹配最适合的模板
- 🎨 支持多种布局类型（字母展示、练习游戏、互动问答等）
- 📐 自动调整元素位置和样式

### 3. 完整PPT结构输出
- 📄 一次性生成完整的两页PPT结构
- 🎮 包含交互元素和动画效果
- 💾 支持JSON格式导出，便于前端渲染

## 🛠️ API接口说明

### 接口地址
```
POST /api/ai/generate-ppt
```

### 请求参数
```json
{
  "outlineContent": "课程大纲内容（必填）",
  "subject": "学科名称（可选，默认：英语）",
  "gradeLevel": "年级水平（可选，默认：幼儿园）"
}
```

### 响应格式
```json
{
  "success": true,
  "message": "PPT生成成功",
  "data": {
    "pptStructure": {
      "title": "基于AI生成的教学PPT",
      "subject": "英语",
      "gradeLevel": "幼儿园",
      "totalSlides": 2,
      "templateId": "template_abc_learning_001",
      "templateName": "字母学习基础模板",
      "slides": [
        {
          "slideNumber": 1,
          "layoutType": "字母展示页",
          "style": {
            "backgroundColor": "#F0F8FF",
            "fontFamily": "Comic Sans MS"
          },
          "elements": [
            {
              "type": "title",
              "position": {"x": 50, "y": 10, "width": 400, "height": 60},
              "style": {"fontSize": 36, "fontWeight": "bold", "color": "#4A90E2"},
              "content": "字母A的学习"
            },
            {
              "type": "letter_display",
              "position": {"x": 100, "y": 100, "width": 200, "height": 200},
              "style": {"fontSize": 120, "fontWeight": "bold", "color": "#7ED321"},
              "content": "A"
            }
          ],
          "interactiveElements": [
            {
              "type": "点击发音",
              "description": "点击字母A听发音",
              "instruction": "请跟着老师一起读：A says /æ/, /æ/, /æ/"
            }
          ]
        }
      ]
    },
    "knowledgePoints": {
      "subject": "英语",
      "gradeLevel": "幼儿园",
      "totalPages": 2,
      "learningObjectives": [
        "认识字母A的大小写形式",
        "掌握字母A的发音",
        "学会3个以A开头的单词"
      ],
      "pages": [...]
    },
    "templateInfo": {
      "templateId": "template_abc_learning_001",
      "templateName": "字母学习基础模板",
      "subject": "英语",
      "gradeLevel": "幼儿园"
    },
    "generatedAt": 1703123456789
  }
}
```

## 🧪 测试方法

### 1. 后端测试
```bash
# 安装依赖
npm install axios

# 运行测试脚本
node test-generate-ppt.js
```

### 2. 前端测试
```bash
# 打开测试页面
open frontend-example.html
```

### 3. 手动API测试
```bash
curl -X POST http://localhost:8080/api/ai/generate-ppt \
  -H "Content-Type: application/json" \
  -d '{
    "outlineContent": "## 教学目标\n* 认识字母A\n* 学会发音/æ/",
    "subject": "英语",
    "gradeLevel": "幼儿园"
  }'
```

## 📊 数据流程

```
课程大纲输入 → AI内容分析 → 模板匹配 → PPT结构生成 → 前端渲染
     ↓              ↓           ↓           ↓           ↓
  用户提供      Gemini AI    数据库查询   JSON结构    幻灯片展示
```

## 🎨 支持的模板类型

### 1. 字母学习模板
- 适用学科：英语
- 适用年级：幼儿园、小学低年级
- 特色功能：字母展示、发音练习、单词联想

### 2. 练习游戏模板
- 适用学科：通用
- 适用年级：全年级
- 特色功能：选择题、拖拽游戏、互动问答

### 3. 词汇学习模板
- 适用学科：语言类
- 适用年级：小学、初中
- 特色功能：图文对照、发音练习、记忆游戏

## 🔧 配置说明

### 环境变量
```bash
# Gemini AI API密钥（必填）
GEMINI_API_KEY=your_gemini_api_key

# 数据库连接（可选，用于模板查询）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=teachppt
DB_USER=root
DB_PASSWORD=password
```

### 应用配置
```yaml
# application.yml
app:
  ai:
    gemini:
      api-key: ${GEMINI_API_KEY}
```

## 🚨 注意事项

1. **API密钥配置**：确保正确配置Gemini API密钥
2. **网络连接**：需要稳定的网络连接访问AI服务
3. **内容长度**：建议课程大纲内容控制在2000字符以内
4. **响应时间**：AI生成过程可能需要10-30秒，请耐心等待
5. **错误处理**：如果AI服务不可用，系统会自动使用模拟数据

## 📈 性能优化建议

1. **缓存机制**：对相似的大纲内容进行缓存
2. **异步处理**：使用队列处理大批量生成请求
3. **模板预加载**：提前加载常用模板到内存
4. **内容压缩**：对生成的JSON数据进行压缩传输

## 🔮 未来扩展

- [ ] 支持更多学科模板
- [ ] 增加多语言支持
- [ ] 集成语音合成功能
- [ ] 支持自定义模板上传
- [ ] 添加PPT导出功能（PowerPoint格式）
- [ ] 集成图片生成AI服务

## 📞 技术支持

如有问题，请联系开发团队或查看相关文档。
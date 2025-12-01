# WebCut

一个强大的Web视频编辑UI框架，力助Web应用快速集成专业级的视频编辑功能。

## 项目描述

WebCut是一款专为Web应用开发的视频编辑UI框架，它通过直观的画布界面和丰富的编辑工具，让开发者能够轻松集成视频编辑功能到自己的应用中。无论是简单的视频剪辑、添加文本和图形，还是复杂的时间线管理，WebCut都能提供高效且灵活的实现方式。

## 思想理念

WebCut的核心设计理念是将复杂的视频编辑功能以简单易用的方式呈现给开发者。我们相信，在Web平台上实现专业级的视频编辑不应该是一项艰巨的任务。通过精心设计的组件化架构和响应式API，WebCut让开发者能够专注于创意实现，而不是底层技术细节。

我们致力于：

- **易用性优先**：提供直观的接口和清晰的文档
- **性能优化**：确保在浏览器环境中流畅运行
- **可扩展性**：模块化设计，易于扩展和定制
- **类型安全**：全面的TypeScript支持，减少错误并提高开发效率

## 核心功能

- 🎨 **视频画布编辑**：基于Canvas的直观视频编辑界面
- 🎬 **完整播放器控制**：提供播放/暂停、进度控制和音量调节等功能
- 📝 **丰富的文本叠加**：支持添加和自定义多种样式的文本
- ⏱️ **时间线管理**：高级时间线功能，支持缩放和精确控制
- 🎭 **元素调整**：通过可调整的控制框来缩放和定位元素
- 📊 **尺寸测量工具**：测量文本、视频和图像的尺寸
- 🔧 **实用工具函数**：导出为Blob、文本渲染为图像等功能
- 📱 **响应式设计**：适配不同屏幕尺寸

## 简洁用法示例

以下是一个基本的使用示例，展示了如何在Vue项目中集成WebCut：

```vue
<script setup lang="ts">
import { WebCutEditor } from 'webcut';
import 'webcut/esm/style.css';
</script>

<template>
    <div class="some-page">
      <aside>
        ...
      </aside>
      <main>
        <WebCutEditor :project-id="yourProjectId" />
      </main>
    </div>
</template>
```

上面的代码示例，是最快速在Vue项目中轻松集成WebCut视频编辑功能的演示。
这段代码会在你的应用中渲染一个完整的视频编辑界面，包括视频画布、工具栏和时间线等。
你也可以根据自己的需要，从`webcut`中引入不同的组件和工具来定制化你的视频编辑界面。

## 安装

```bash
# 使用 npm
npm install webcut

# 使用 yarn
yarn add webcut

# 使用 pnpm
pnpm add webcut
```

## 文档

详细的使用文档和API参考将在未来的文档网站中提供。

## 开源许可

本项目采用MIT开源许可证。详见[LICENSE](LICENSE)文件。

## 感谢

WebCut的开发离不开以下优秀开源项目的支持：

- [@webav/av-canvas](https://github.com/bilibili/webav/tree/main/packages/av-canvas) - 提供底层视频渲染能力
- [@webav/av-cliper](https://github.com/bilibili/webav/tree/main/packages/av-cliper) - 视频剪辑功能支持
- [Vue 3](https://vuejs.org/) - 响应式前端框架
- [TypeScript](https://www.typescriptlang.org/) - 类型系统支持
- [naive-ui](https://www.naiveui.com/) - UI组件库
- [@vicons](https://vicons.mono.company/) - 图标库

感谢这些项目的贡献者们为开源社区做出的努力！
# 组件概览

用于构建编辑器 UI 的核心导出组件。

## 核心视图

- `WebCutEditor` — 一体化编辑器容器 (`src/views/editor/index.vue`)。
- `WebCutProvider` — 为子组件提供上下文 (`src/views/provider/index.vue`)。
- `WebCutPlayer`、`WebCutPlayerScreen`、`WebCutPlayerButton` — 播放器视图 (`src/views/player/*`)。
- `WebCutManager` — 时间线管理器 (`src/views/manager/index.vue`)。
- `WebCutManagerContainer` — 时间线容器 (`src/views/manager/container/index.vue`)。
- `WebCutManagerScaler` — 时间线缩放控制器 (`src/views/manager/scaler/index.vue`)。
- `WebCutManagerAsideRail` — 时间线轨道侧边栏 (`src/views/manager/aside/index.vue`)。
- `WebCutManagerMainSegment` — 时间线片段主区域 (`src/views/manager/main/index.vue`)。
- `WebCutManagerToolBar` — 时间线工具栏 (`src/views/manager/tool-bar/index.vue`)。
- `WebCutLibrary` — 素材库（音频、图片、文本、视频）(`src/views/library/*`)。
- `WebCutLibraryAside` — 素材库侧边栏 (`src/views/library/_shared/aside.vue`)。
- `WebCutLibraryImport` — 素材库导入组件 (`src/views/library/_shared/import.vue`)。
- `WebCutLibraryList` — 素材库列表组件 (`src/views/library/_shared/list.vue`)。
- `WebCutLibraryContainer` — 素材库容器组件 (`src/views/library/_shared/container.vue`)。
- `WebCutPanel`、`WebCutBasicPanel`、`WebCutTextPanel`、`WebCutAudioPanel`、`WebCutVideoPanel`、`WebCutFilterPanel`、`WebCutAnimationPanel` — 编辑面板 (`src/views/panel/*`)。
- `WebCutSelectAspectRatio` — 画布比例选择器 (`src/views/select-aspect-ratio/index.vue`)。
- `WebCutTimeClock` — 时间显示 (`src/views/time-clock/index.vue`)。
- `WebCutThemeSwitch` — 暗色模式切换 (`src/views/theme-switch/index.vue`)。
- `WebCutThemeBox` — 主题选择框 (`src/views/theme-box/index.vue`)。
- `WebCutExportButton` — 导出按钮 (`src/views/export-button/index.vue`)。
- `WebCutExport` — 高级导出组件 (`src/modules/advanced-export/index.vue`)。
- `WebCutExportPanel` — 导出面板 (`src/modules/advanced-export/export-panel.vue`)。
- `WebCutExportModal` — 导出模态框 (`src/modules/advanced-export/export-modal.vue`)。
- `WebCutLangSwitch` — 语言切换 (`src/views/lang-switch/index.vue`)。
- `WebCutLoading` — 加载提示组件 (`src/views/loading/index.vue`)。
- `WebCutToast` — 消息提示组件 (`src/views/toast/index.vue`)。

## 片段组件

- `WebCutVideoSegment` — 视频片段 (`src/views/manager/segments/video.vue`)。
- `WebCutAudioSegment` — 音频片段 (`src/views/manager/segments/audio.vue`)。
- `WebCutImageSegment` — 图片片段 (`src/views/manager/segments/image.vue`)。
- `WebCutTextSegment` — 文本片段 (`src/views/manager/segments/text.vue`)。

## 工具组件

- `WebCutClearTool` — 清空时间线工具 (`src/views/tools/clear/index.vue`)。
- `WebCutDeleteTool` — 删除片段工具 (`src/views/tools/delete/index.vue`)。
- `WebCutSplitTool` — 分割片段工具 (`src/views/tools/split/index.vue`)。
- `WebCutSplitKeepLeftTool` — 分割并保留左侧片段工具 (`src/views/tools/split-keep-left/index.vue`)。
- `WebCutSplitKeepRightTool` — 分割并保留右侧片段工具 (`src/views/tools/split-keep-right/index.vue`)。
- `WebCutFlipHorizontalTool` — 水平翻转工具 (`src/views/tools/flip-h/index.vue`)。
- `WebCutConcatTool` — 拼接片段工具 (`src/views/tools/concat/index.vue`)。

所有工具组件都位于 `src/views/tools/*` 目录下，操作当前片段和游标。

## 基础组件

- `AdjustableBox` — 可调整大小的容器 (`src/components/adjustable-box/index.vue`)。
- `AudioShape` — 音频波形可视化 (`src/components/audio-shape/index.vue`)。
- `ContextMenu` — 上下文菜单组件 (`src/components/context-menu/index.vue`)。
- `ScrollBox` — 自定义滚动容器 (`src/components/scroll-box/index.vue`)。
- `DraggableHandler` — 可拖动的手柄组件 (`src/components/draggable-handler/index.vue`)。
- `RotateInput` — 旋转角度输入组件 (`src/components/rotate-input/index.vue`)。

## 使用示例

### 基本使用

```vue
<script setup lang="ts">
import { WebCutProvider, WebCutEditor, WebCutThemeSwitch } from 'webcut'
</script>

<template>
  <WebCutProvider>
    <WebCutThemeSwitch />
    <WebCutEditor :project-id="'project-1'" />
  </WebCutProvider>
</template>
```

### 高级使用

```vue
<script setup lang="ts">
import { 
  WebCutProvider, 
  WebCutEditor, 
  WebCutThemeSwitch,
  WebCutLangSwitch,
  WebCutExportButton,
  WebCutToast,
  WebCutLoading
} from 'webcut'
import { ref } from 'vue'

const isLoading = ref(false)
const showToast = ref(false)

const handleExport = () => {
  showToast.value = true
}
</script>

<template>
  <WebCutProvider>
    <div class="toolbar">
      <WebCutThemeSwitch />
      <WebCutLangSwitch />
      <WebCutExportButton @click="handleExport" />
    </div>
    <WebCutEditor :project-id="'project-1'" />
    <WebCutLoading v-if="isLoading" />
    <WebCutToast v-if="showToast" message="导出成功！" />
  </WebCutProvider>
</template>
```

### 自定义面板

```vue
<script setup lang="ts">
import { 
  WebCutProvider, 
  WebCutEditor,
  WebCutPanel,
  WebCutBasicPanel,
  WebCutTextPanel,
  WebCutVideoPanel,
  WebCutAudioPanel,
  WebCutFilterPanel,
  WebCutAnimationPanel
} from 'webcut'
import { computed } from 'vue'

const selectedType = computed(() => {
  // 根据选中的片段类型返回不同的面板
  return 'video' // 可以是 'basic', 'text', 'video', 'audio', 'filter', 'animation'
})
</script>

<template>
  <WebCutProvider>
    <div class="editor-layout">
      <WebCutEditor :project-id="'project-1'" />
      <WebCutPanel>
        <WebCutBasicPanel v-if="selectedType === 'basic'" />
        <WebCutTextPanel v-else-if="selectedType === 'text'" />
        <WebCutVideoPanel v-else-if="selectedType === 'video'" />
        <WebCutAudioPanel v-else-if="selectedType === 'audio'" />
        <WebCutFilterPanel v-else-if="selectedType === 'filter'" />
        <WebCutAnimationPanel v-else-if="selectedType === 'animation'" />
      </WebCutPanel>
    </div>
  </WebCutProvider>
</template>
```

查看 `src/index.ts` 中的完整导出列表。
# Components

Key exported components for building your editor UI.

## Core Views

- `WebCutEditor` — all-in-one editor container (`src/views/editor/index.vue`).
- `WebCutProvider` — provides context to child components (`src/views/provider/index.vue`).
- `WebCutPlayer`, `WebCutPlayerScreen`, `WebCutPlayerButton` — player views (`src/views/player/*`).
- `WebCutManager` — timeline manager (`src/views/manager/index.vue`).
- `WebCutManagerContainer` — timeline container (`src/views/manager/container/index.vue`).
- `WebCutManagerScaler` — timeline scaler (`src/views/manager/scaler/index.vue`).
- `WebCutManagerAsideRail` — timeline aside rail (`src/views/manager/aside/index.vue`).
- `WebCutManagerMainSegment` — timeline main segment area (`src/views/manager/main/index.vue`).
- `WebCutManagerToolBar` — timeline toolbar (`src/views/manager/tool-bar/index.vue`).
- `WebCutLibrary` — asset library (audio, image, text, video) (`src/views/library/*`).
- `WebCutLibraryAudio` — audio library component (`src/views/library/audio/index.vue`).
- `WebCutLibraryImage` — image library component (`src/views/library/image/index.vue`).
- `WebCutLibraryText` — text library component (`src/views/library/text/index.vue`).
- `WebCutLibraryVideo` — video library component (`src/views/library/video/index.vue`).
- `WebCutPanel`, `WebCutBasicPanel`, `WebCutTextPanel` — edit panels (`src/views/panel/*`).
- `WebCutSelectAspectRatio` — canvas aspect ratio selector (`src/views/select-aspect-ratio/index.vue`).
- `WebCutTimeClock` — time display (`src/views/time-clock/index.vue`).
- `WebCutThemeSwitch` — dark mode toggle (`src/views/theme-switch/index.vue`).
- `WebCutExportButton` — export button (`src/views/export-button/index.vue`).
- `WebCutLangSwitch` — language switcher (`src/views/lang-switch/index.vue`).
- `WebCutThemeBox` — theme selection box (`src/views/theme-box/index.vue`).
- `WebCutExport` — export component (`src/views/export/index.vue`).
- `WebCutExportPanel` — export panel (`src/views/export/panel/index.vue`).
- `WebCutExportModal` — export modal (`src/views/export/modal/index.vue`).
- `WebCutLoading` — loading component (`src/views/loading/index.vue`).
- `WebCutToast` — toast notification component (`src/views/toast/index.vue`).

## Segments

- `WebCutVideoSegment` — video segment (`src/views/manager/segments/video.vue`).
- `WebCutAudioSegment` — audio segment (`src/views/manager/segments/audio.vue`).
- `WebCutImageSegment` — image segment (`src/views/manager/segments/image.vue`).
- `WebCutTextSegment` — text segment (`src/views/manager/segments/text.vue`).

## Tools

- `WebCutClearTool` — clear timeline tool (`src/views/tools/clear/index.vue`).
- `WebCutDeleteTool` — delete segment tool (`src/views/tools/delete/index.vue`).
- `WebCutSplitTool` — split segment tool (`src/views/tools/split/index.vue`).
- `WebCutSplitKeepLeftTool` — split and keep left segment tool (`src/views/tools/split-keep-left/index.vue`).
- `WebCutSplitKeepRightTool` — split and keep right segment tool (`src/views/tools/split-keep-right/index.vue`).
- `WebCutFlipHorizontalTool` — flip horizontal tool (`src/views/tools/flip-h/index.vue`).
- `WebCutConcatTool` — concatenate segments tool (`src/views/tools/concat/index.vue`).

All tools live under `src/views/tools/*` and operate on the current segment and cursor.

## Base Components

- `AdjustableBox` — adjustable size container (`src/components/adjustable-box/index.vue`).
- `AudioShape` — audio waveform visualization (`src/components/audio-shape/index.vue`).
- `ContextMenu` — context menu component (`src/components/context-menu/index.vue`).
- `ScrollBox` — custom scroll container (`src/components/scroll-box/index.vue`).
- `DraggableHandler` — draggable handler component (`src/components/draggable-handler/index.vue`).
- `RotateInput` — rotate input component (`src/components/rotate-input/index.vue`).

## Usage

### Basic Usage

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

### Advanced Usage

```vue
<script setup lang="ts">
import {
  WebCutProvider,
  WebCutEditor,
  WebCutThemeSwitch,
  WebCutLibrary,
  WebCutLibraryAudio,
  WebCutLibraryImage,
  WebCutLibraryText,
  WebCutLibraryVideo,
  WebCutExport,
  WebCutExportPanel,
  WebCutLoading,
  WebCutToast
} from 'webcut'

const projectId = ref('project-1')
const showExport = ref(false)
const isLoading = ref(false)
</script>

<template>
  <WebCutProvider>
    <!-- Theme and Language Controls -->
    <div class="controls">
      <WebCutThemeSwitch />
      <WebCutLangSwitch />
    </div>

    <!-- Main Editor -->
    <WebCutEditor :project-id="projectId" />

    <!-- Media Libraries -->
    <div class="libraries">
      <WebCutLibrary>
        <WebCutLibraryAudio />
        <WebCutLibraryImage />
        <WebCutLibraryText />
        <WebCutLibraryVideo />
      </WebCutLibrary>
    </div>

    <!-- Export Components -->
    <WebCutExport v-if="showExport" @close="showExport = false" />
    <WebCutExportPanel v-if="showExport" />

    <!-- Loading and Toast Notifications -->
    <WebCutLoading v-if="isLoading" message="Processing..." />
    <WebCutToast />
  </WebCutProvider>
</template>
```

### Custom Panel Implementation

```vue
<script setup lang="ts">
import { WebCutPanel, WebCutBasicPanel } from 'webcut'

const customPanelConfig = {
  title: 'Custom Effects',
  icon: 'effects',
  components: ['blur', 'brightness', 'contrast']
}
</script>

<template>
  <WebCutPanel :config="customPanelConfig">
    <WebCutBasicPanel>
      <!-- Custom panel content -->
      <div class="custom-effects">
        <!-- Effect controls -->
      </div>
    </WebCutBasicPanel>
  </WebCutPanel>
</template>
```

### Component Props

#### WebCutEditor Props
- `projectId: string` - Unique identifier for the project
- `width?: number` - Editor width (default: 100%)
- `height?: number` - Editor height (default: 600px)
- `theme?: 'light' | 'dark'` - Theme mode
- `locale?: string` - Language locale
- `readonly?: boolean` - Whether editor is in read-only mode

#### WebCutProvider Props
- `projectId?: string` - Project identifier
- `initialState?: WebCutState` - Initial state configuration
- `plugins?: Plugin[]` - Array of plugins to load

#### WebCutLibrary Props
- `type?: 'audio' | 'image' | 'text' | 'video'` - Library type filter
- `multiple?: boolean` - Allow multiple selection
- `maxItems?: number` - Maximum number of items

#### WebCutExport Props
- `formats?: ExportFormat[]` - Available export formats
- `quality?: ExportQuality` - Default export quality
- `onExport?: (config: ExportConfig) => void` - Export callback

### Component Events

#### WebCutEditor Events
- `@ready` - Fired when editor is initialized
- `@error` - Fired when an error occurs
- `@change` - Fired when project state changes

#### WebCutLibrary Events
- `@select` - Fired when items are selected
- `@add` - Fired when items are added to timeline
- `@remove` - Fired when items are removed

#### WebCutExport Events
- `@export` - Fired when export is initiated
- `@progress` - Fired during export progress
- `@complete` - Fired when export is complete
- `@cancel` - Fired when export is cancelled

### Styling

Components use CSS custom properties for theming:

```css
:root {
  --webcut-primary-color: #007bff;
  --webcut-secondary-color: #6c757d;
  --webcut-background-color: #ffffff;
  --webcut-text-color: #333333;
  --webcut-border-color: #dee2e6;
  --webcut-border-radius: 4px;
  --webcut-spacing: 8px;
}
```

Dark theme:

```css
[data-theme="dark"] {
  --webcut-primary-color: #0d6efd;
  --webcut-secondary-color: #6c757d;
  --webcut-background-color: #212529;
  --webcut-text-color: #ffffff;
  --webcut-border-color: #495057;
}
```

See exports in `src/index.ts`.
# Components

Key exported components for building your editor UI.

## Core Views

- `WebCutEditor` — all-in-one editor container (`src/views/editor/index.vue`).
- `WebCutProvider` — provides context to child components (`src/views/provider/index.vue`).
- `WebCutPlayer`, `WebCutPlayerScreen`, `WebCutPlayerButton` — player views (`src/views/player/*`).
- `WebCutManager`, `WebCutManagerScaler` — timeline manager and scaler (`src/views/manager/*`).
- `WebCutLibrary` — asset library (audio, image, text, video) (`src/views/library/*`).
- `WebCutPanel`, `WebCutBasicPanel`, `WebCutTextPanel` — edit panels (`src/views/panel/*`).
- `WebCutSelectAspectRatio` — canvas aspect ratio selector (`src/views/select-aspect-ratio/index.vue`).
- `WebCutTimeClock` — time display (`src/views/time-clock/index.vue`).
- `WebCutThemeSwitch` — dark mode toggle (`src/views/dark-mode/theme-switch.vue`).

## Segments

- `WebCutVideoSegment`, `WebCutAudioSegment`, `WebCutImageSegment`, `WebCutTextSegment` (`src/views/manager/segments/*`).

## Tools

- `WebCutSplitCurrentTool`, `WebCutSplitKeepLeftTool`, `WebCutSplitKeepRightTool`
- `WebCutDeleteCurrentTool`, `WebCutClearSelectedTool`
- `Undo`, `Redo`

All tools live under `src/views/tools/*` and operate on the current segment and cursor.

## Base Components

- `AdjustableBox`, `AudioShape`, `ContextMenu`, `ScrollBox`, `DraggableHandler`, `RotateInput` (`src/components/*`).

## Usage

```vue
<script setup lang="ts">
import { WebCutEditor, WebCutThemeSwitch } from 'webcut'
</script>

<template>
  <WebCutThemeSwitch />
  <WebCutEditor :project-id="'project-1'" />
</template>
```

See exports in `src/index.ts:32`.
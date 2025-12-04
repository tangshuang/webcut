# 库（Libs）

用于文本渲染、测量、自动适配、导出与时间线计算的工具函数。

## 文本渲染

- `renderTxt2ImgBitmap(text, css, highlights)` → `ImageBitmap`（见 `src/libs/index.ts:27`）
- `buildTextAsDOM({ text, css, highlights })` → `HTMLElement`（见 `src/libs/index.ts:86`）
- `cssToText(css)`、`textToCss(text)` 转换 CSS

## 测量

- `measureVideoSize(source)` → `{ width, height }`（见 `src/libs/index.ts:317`）
- `measureImageSize(source)` → `{ width, height }`（见 `src/libs/index.ts:336`）
- `measureVideoDuration(source)` → `ns`（见 `src/libs/index.ts:360`）
- `measureAudioDuration(source)` → `ns`（见 `src/libs/index.ts:384`）
- `measureTextSize(text, css, highlights)` → `{ height, width }`（见 `src/libs/index.ts:409`）

## 导出

- `exportBlobOffscreen(clips)` → MP4 Blob（见 `src/libs/index.ts:420`）
- `exportAsWavBlobOffscreen(clips)` → WAV Blob（见 `src/libs/index.ts:453`）
- `mp4BlobToWavBlob(mp4Blob)`（见 `src/libs/index.ts:458`）

## 自动适配

- `autoFitRect(canvasSize, elementSize, type)` → `{ w, h, x, y }`（见 `src/libs/index.ts:477`）

## 时间格式化

- `formatTime(ns)` → `HH:MM:SS.mmm`（见 `src/libs/index.ts:512`）

## 文件工具

- `base64ToFile`、`blobToBase64DataURL`、`fileToBase64DataURL`、`downloadBlob`、`getFileMd5`、`blobToFile`（见 `src/libs/file.ts:11`）

## 媒体工具

- `mp4ClipToFile(clip)`、`audioClipToFile(clip)`、`pcmToWav(pcm, sampleRate)`（见 `src/libs/index.ts:4`）

## 时间线计算

- `getGridSize`、`getGridPixel`、`getGridFrame`、`getStep`、`getLongText`、`durationToFrame`、`frameToDuration`、`formatTime`（见 `src/libs/timeline.ts:1`）
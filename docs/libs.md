# Libs

Utilities for text rendering, measurement, auto-fit, exporting, and timeline math.

## Text Rendering

- `renderTxt2ImgBitmap(text, css, highlights)` → `ImageBitmap` (see `src/libs/index.ts:27`)
- `buildTextAsDOM({ text, css, highlights })` → `HTMLElement` (see `src/libs/index.ts:86`)
- `cssToText(css)`, `textToCss(text)` for CSS conversion

## Measure

- `measureVideoSize(source)` → `{ width, height }` (see `src/libs/index.ts:317`)
- `measureImageSize(source)` → `{ width, height }` (see `src/libs/index.ts:336`)
- `measureVideoDuration(source)` → `ns` (see `src/libs/index.ts:360`)
- `measureAudioDuration(source)` → `ns` (see `src/libs/index.ts:384`)
- `measureTextSize(text, css, highlights)` → `{ height, width }` (see `src/libs/index.ts:409`)

## Export

- `exportBlobOffscreen(clips)` → MP4 Blob (see `src/libs/index.ts:420`)
- `exportAsWavBlobOffscreen(clips)` → WAV Blob (see `src/libs/index.ts:453`)
- `mp4BlobToWavBlob(mp4Blob)` (see `src/libs/index.ts:458`)

## Auto Fit

- `autoFitRect(canvasSize, elementSize, type)` → `{ w, h, x, y }` (see `src/libs/index.ts:477`)

## Time Formatting

- `formatTime(ns)` → `HH:MM:SS.mmm` (see `src/libs/index.ts:512`)

## File Helpers

- `base64ToFile`, `blobToBase64DataURL`, `fileToBase64DataURL`, `downloadBlob`, `getFileMd5`, `blobToFile` (see `src/libs/file.ts:11`)

## Media Helpers

- `mp4ClipToFile(clip)`, `audioClipToFile(clip)`, `pcmToWav(pcm, sampleRate)` (see `src/libs/media.ts:4`)

## Timeline Math

- `getGridSize`, `getGridPixel`, `getGridFrame`, `getStep`, `getLongText`, `durationToFrame`, `frameToDuration`, `formatTime` (see `src/libs/timeline.ts:1`)
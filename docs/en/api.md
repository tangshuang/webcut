# API Reference

This is a detailed reference for all exports from `src/index.ts`. It explains responsibilities, parameters, return values, events, and internal behaviors, with source locations for quick navigation.

## Components

### WebCutProvider
- Purpose: Provides the `WebCutContext` and UI theme/locale wrappers of Naive UI.
- Props: `{ data?: Partial<WebCutContext> }` (`src/views/provider/index.vue:22`). When provided, merges with defaults and becomes the shared reactive context (`src/hooks/index.ts:20–49`).
- Behavior:
  - Initializes dark/light theme overrides (`src/views/provider/index.vue:37–101`), locale based on `navigator.language` (`src/views/provider/index.vue:103–119`).
  - Provides `WEBCUT_CONTEXT` so child components and hooks can consume it (`src/views/provider/index.vue:126`, `src/hooks/index.ts:95`).
- Slots: Default slot renders the editor UI inside Naive UI providers.

### WebCutEditor
- Purpose: Turn‑key editor view combining Library, PlayerScreen, Controls, Panels, and Manager timeline.
- Props: `{ projectId?: string }` (`src/views/editor/index.vue:30`). Passes `id` into `useWebCutContext` to scope project state (`src/views/editor/index.vue:34–37`).
- Behavior:
  - Resizes Manager based on layout (`src/views/editor/index.vue:42–46`), connects timeline operations (`useWebCutManager`) and player (`useWebCutPlayer`).
  - Exposes export button using `useWebCutPlayer.download` (`src/views/editor/index.vue:87–93`).

### WebCutPlayerScreen
- Purpose: Canvas viewport that hosts `AVCanvas` rendering and exposes a small player API/event bus.
- Props: `{ maxWidth?: number; maxHeight?: number }` (`src/views/player/screen.vue:6–11`).
- Exposed API: `player.value = { fitBoxSize, on, off, once, emit }` (`src/views/player/screen.vue:73–81`). Consumers can listen to `timeupdate`, `playing`, `paused`, `active`, `change` emitted by `useWebCutPlayer` (`src/hooks/index.ts:246–296`).
- Behavior:
  - Computes scale to fit container and optional max constraints (`src/views/player/screen.vue:30–60`).
  - Syncs size on window resize and on viewport changes.

### WebCutPlayerButton
- Purpose: Playback controls with optional skip to ends.
- Props: `{ displaySkipButtons?: boolean }` (`src/views/player/button.vue:6–8`).
- Behavior: Maps `status` −1/0/1 to icons and actions (`src/views/player/button.vue:13–22`). Skip forward moves to `duration - fps` (`src/views/player/button.vue:24–26`).

### WebCutManager
- Purpose: Timeline rails and segment editing container (vertical rails with segments).
- Props: `topBarColor?`, `railBgColor?`, `segmentBgColor?`, `segmentBorderColor?`, `segmentHandlerColor?`, `asideWidth?`, `disableEmptyRail?`, `railHeight?`, `railHeightByType?`, `disableSort?`, `disableResize?` (`src/views/manager/index.vue:21–38`).
- Emits: `sort`, `resize` when segments are reordered/resized (`src/views/manager/index.vue:18`, `src/views/manager/index.vue:151`).
- v-model: `maxHeight` to constrain internal scroll areas (`src/views/manager/index.vue:20`). Public method `resizeManagerMaxHeight(h)` is proxied via `useWebCutManager` (`src/views/manager/index.vue:90–93`).
- Behavior: Auto layout rails height from prop map per type, keeps scroll areas synced, exposes slots for rail aside and segment rendering (`src/views/manager/index.vue:67–88`, `src/views/manager/index.vue:126–157`).

### WebCutManagerContainer
- Purpose: Container component for the manager, providing layout and scroll synchronization.
- Used internally by WebCutManager to wrap the manager UI.

### WebCutManagerScaler
- Purpose: UI control for timeline scale; changes `scale` used by grid math.
- Used inside Editor bottom bar to adjust timeline zoom level (`src/views/editor/index.vue:122–123`).

### WebCutManagerAsideRail
- Purpose: Rail aside component for displaying rail information and controls.
- Used inside WebCutManager to render the left sidebar of rails (`src/views/manager/aside/index.vue`).

### WebCutManagerMainSegment
- Purpose: Main segment container for rendering and editing segments.
- Used inside WebCutManager to render the main timeline area with segments (`src/views/manager/main/index.vue`).

### WebCutManagerToolBar
- Purpose: Toolbar component for manager operations.
- Provides tools like zoom, fit, and other timeline operations (`src/views/manager/tool-bar/index.vue`).

### WebCutPlayer
- Purpose: Player container used within Editor; delegates to PlayerScreen and PlayerButton.
- Combines the player screen and controls into a single component (`src/views/player/index.vue`).

### WebCutSelectAspectRatio
- Purpose: Change canvas dimensions by predefined aspect ratios.
- Props: `{ displayAspect?: boolean }` (`src/views/select-aspect-ratio/index.vue:14–17`).
- Behavior:
  - Tracks current ratio by comparing `width/height` to known ratios (`src/views/select-aspect-ratio/index.vue:74–86`).
  - On select, updates `width`/`height` in context (`src/views/select-aspect-ratio/index.vue:89–95`).
  - Options include `21:9`, `16:9`, `4:3`, `9:16`, `3:4`, `1:1` with exact target sizes (`src/views/select-aspect-ratio/index.vue:64–72`).

### WebCutLibrary
- Purpose: Project file library with list, add, remove operations.
- Behavior: Binds to project id, loads project files, deduplicates by MD5, updates DB relations on add/remove (`src/hooks/library.ts:14–59`).

### WebCutPanel
- Purpose: Main panel container for property editing.
- Hosts different types of panels based on the selected segment type (`src/views/panel/index.vue`).

### WebCutBasicPanel
- Purpose: Basic property panel for editing common segment properties.
- Provides controls for position, size, rotation, opacity, etc. (`src/views/panel/basic/index.vue`).

### WebCutTextPanel
- Purpose: Text property panel for editing text segments.
- Provides controls for text content, style, formatting, etc. (`src/views/panel/text/index.vue`).

### WebCutExportButton
- Purpose: Button component for exporting the project.
- Triggers the export process using `useWebCutPlayer.download` (`src/views/export-button/index.vue`).

### WebCutLangSwitch
- Purpose: Language switch component for changing the editor locale.
- Allows users to switch between different languages (`src/views/lang-switch/index.vue`).

### WebCutThemeSwitch
- Purpose: Theme switch component for toggling dark/light mode.
- Changes the editor's color scheme (`src/views/theme-switch/index.vue`).

### WebCutTimeClock
- Purpose: Displays the current time in the editor.
- Shows the current timeline cursor position (`src/views/time-clock/index.vue`).

### Segment Components
- **WebCutVideoSegment**: Renders video segments in the timeline (`src/views/manager/segments/video.vue`).
- **WebCutAudioSegment**: Renders audio segments in the timeline (`src/views/manager/segments/audio.vue`).
- **WebCutImageSegment**: Renders image segments in the timeline (`src/views/manager/segments/image.vue`).
- **WebCutTextSegment**: Renders text segments in the timeline (`src/views/manager/segments/text.vue`).
- These components render per-type segment UI inside Manager slots (`src/views/editor/index.vue:151–155`).

### Tool Components
- **WebCutClearTool**: Clears all segments from the timeline (`src/views/tools/clear/index.vue`).
- **WebCutDeleteTool**: Deletes the selected segments (`src/views/tools/delete/index.vue`).
- **WebCutSplitTool**: Splits segments at the cursor position (`src/views/tools/split/index.vue`).
- **WebCutSplitKeepLeftTool**: Splits segments and keeps only the left part (`src/views/tools/split-keep-left/index.vue`).
- **WebCutSplitKeepRightTool**: Splits segments and keeps only the right part (`src/views/tools/split-keep-right/index.vue`).
- **WebCutFlipHorizontalTool**: Flips segments horizontally (`src/views/tools/flip-h/index.vue`).
- **WebCutConcatTool**: Concatenates segments (`src/views/tools/concat/index.vue`).

### Utility Components
- **AdjustableBox**: Resizable box component for property panels (`src/components/adjustable-box/index.vue`).
- **AudioShape**: Audio waveform visualization component (`src/components/audio-shape/index.vue`).
- **ContextMenu**: Context menu component for right-click operations (`src/components/context-menu/index.vue`).
- **ScrollBox**: Scrollable container component with scroll synchronization (`src/components/scroll-box/index.vue`).
- **DraggableHandler**: Draggable handler component for resizing and positioning (`src/components/draggable-handler/index.vue`).
- **RotateInput**: Rotation input component with visual feedback (`src/components/rotate-input/index.vue`).

## Hooks

### Component Hooks

#### useScrollBox
- Purpose: Hook for ScrollBox component, manages scroll behavior.
- Source: `src/components/scroll-box`
- Behavior: Handles scroll events, implements custom scrollbars and scrolling logic.

### Core Hooks

### useWebCutContext(providedContext?: Partial<WebCutContext>)
- Purpose: Provide/consume the shared reactive editor state. If called at the root with `providedContext`, creates and provides; otherwise consumes injected context or constructs default (`src/hooks/index.ts:19–65`, `src/hooks/index.ts:95`).
- State defaults (`src/hooks/index.ts:20–45`):
  - `id: string`, `width: number`, `height: number`, `viewport: HTMLDivElement|null`, `canvas: AVCanvas|null`
  - `clips: MP4Clip|ImgClip|AudioClip[]`, `sprites: VisibleSprite[]`, `sources: Map<string, WebCutSource>`
  - `cursorTime: number` ns, `status: -1|0|1` (stop|pause|play) (`src/types/index.ts:24–27`)
  - `disableSelectSprite: boolean`, `autoResetWhenStop: boolean`
  - `fps: number`, `scale: number` (grid zoom [0,100])
  - timeline refs: `scroll1`, `scroll2`, `ruler`, `manager`, `player`
  - rails: `rails: WebCutRail[]`, selection: `selected[]`, `current: string|null`, undo/redo flags
- Derived/computed (`src/hooks/index.ts:66–174`):
  - `duration: Ref<number>` recalculated from sprites end times; auto‑switches `status` from stop to pause if cursor is in range (`src/hooks/index.ts:66–93`).
  - `currentRail`, `currentSegment`, `currentSource` computed from `selected/current` (`src/hooks/index.ts:132–174`).
- Actions (`src/hooks/index.ts:97–130`):
  - `toggleSegment(segmentId, railId)`, `selectSegment`, `unselectSegment` maintain selection.
- Returns: all refs, `duration`, `updateDuration`, `provide()`, selection actions, and current getters (`src/hooks/index.ts:176–189`).

### useWebCutPlayer()
- Purpose: Player and media operations bound to context and `AVCanvas`.
- Canvas lifecycle/events (`src/hooks/index.ts:232–301`):
  - `init()` creates canvas, adds existing sprites, wires events `timeupdate`, `playing`, `paused`, `activeSpriteChange` and syncs selection with `sources` (`src/hooks/index.ts:237–301`).
  - `play()`, `pause()`, `reset()` control playback and cursor (`src/hooks/index.ts:303–328`).
  - `moveTo(timeNs)` previews frame at time without playing (`src/hooks/index.ts:760–767`).
  - `resize()` triggers PlayerScreen box fitting (`src/hooks/index.ts:783–785`).
- Exporting (`src/hooks/index.ts:330–351`): `exportBlob()` streams MP4 from canvas combinator; `exportAsWavBlob()` converts MP4 to WAV via `mp4BlobToWavBlob`.
- Materials (`src/hooks/index.ts:353–564`):
  - `push(type, source, meta)` supports `video|audio|image|text` with sources: `File`, `data:URL`, `file:<id>`, `http(s)`. Handles audio volume options, autoFitRect for image/video, default durations for image/text (2s), zIndex, time offsets.
  - Creates `VisibleSprite`, sets `sources` map entry including `fileId/url/text/segmentId/railId/meta` (`src/hooks/index.ts:547–559`).
  - Rail assignment: auto create rail per type, mark `video` rail `main`, avoid overlap by creating new rail when segments intersect, reorder rails (`src/hooks/index.ts:508–545`).
  - `remove(key)`, `clear()`, `destroy()` tear down sprites/clips and global state (`src/hooks/index.ts:566–633`).
- Text utilities (`src/hooks/index.ts:634–758`):
  - `initTextMaterial(text, css?, highlights?)` renders text to bitmap, computes rect and rotation from `--transform-rotate`, and normalized CSS (`src/hooks/index.ts:634–691`).
  - `updateText(key, { text?, css?, highlights? })` creates new ImgClip sprite with preserved time/props, swaps into canvas, updates `sources.meta.text` (`src/hooks/index.ts:699–758`).
- Misc:
  - `captureImage()` returns current canvas image (`src/hooks/index.ts:769–772`).
  - `readSources()` returns `Map<string, WebCutSource>` (`src/hooks/index.ts:774–776`).
  - `download(filename?)` exports MP4 and triggers browser download (`src/hooks/index.ts:778–781`).

Parameters:
`WebCutMaterialMeta` (`src/types/index.ts:119–151`)
- `id?`: custom source key
- `rect?`: `{ x,y,w,h,angle }`
- `time?`: `{ start?, duration?, playbackRate? }`
- `audio?`: `{ volume?, loop? }` only for audio or video with audio
- `video?`: `{ volume? }`
- `text?`: `{ css?, highlights? }` for text rendering
- `zIndex?`: number
- `autoFitRect?`: `'contain'|'cover'|'contain_scale'|'cover_scale'`
- `withRailId?`, `withSegmentId?`: place into a specific rail or segment id (used in history recovery)

#### useWebCutData()
- Purpose: Manages editor data, handling loading, saving, and updating of project data.
- Source: `src/hooks/index.ts`
- Behavior: Provides data management functionality, supporting project data persistence and recovery.

#### useWebCutThemeColors()
- Purpose: Manages theme colors for the editor.
- Source: `src/hooks/index.ts`
- Behavior: Provides functionality to get and manage theme colors, supporting custom themes.

#### useWebCutDarkMode()
- Purpose: Manages dark mode state for the editor.
- Source: `src/hooks/index.ts`
- Behavior: Handles dark mode switching and state management.

### Manager Hooks

### useWebCutManager()
- Purpose: Timeline math/control and segment operations (`src/hooks/manager.ts`).
- Cursor and grid:
  - `totalFrameCount`, `totalPx`, `cursorFrame`, `cursorPx` computed (`src/hooks/manager.ts:34–55`).
  - `moveCursorToTime(ns)`, `moveCursorToFrame(frame)`, `moveCursorToPx(px)` preview frame and pause (`src/hooks/manager.ts:68–87`).
  - `timeToPx(ns)`, `pxToTime(px)`, `pxOf1Frame`, `timeOf1Frame` conversions (`src/hooks/manager.ts:89–107`).
- Segment ops:
  - `resetSegmentTime(segment)` updates sprite time and recalculates duration (`src/hooks/manager.ts:109–119`).
  - `toggleRailHidden(rail)` hides/unhides all sprites in rail by toggling `visible` (`src/hooks/manager.ts:125–136`).
  - `toggleRailMute(rail)` sets `clip.tickInterceptor` to drop audio arrays when muted (`src/hooks/manager.ts:138–158`).
  - `deleteSegment({ segment, rail })` destroys clip/sprite, removes segment and rail if empty, clears selection (`src/hooks/manager.ts:160–179`).
  - `splitSegment({ segment, rail, keep })` splits by cursor time; video/audio use codec split and re‑push file artifacts; image/text duplicate segments with adjusted time; preserves `tickInterceptor` (`src/hooks/manager.ts:181–298`).
- Scrolling sync: keeps left/right scroll areas aligned and recenters on cursor when leaving play (`src/hooks/manager.ts:13–32, 56–66`).
- Returns additional refs: `scroll1`, `scroll2`, `ruler` and proxies `resizeManagerMaxHeight(h)` to Manager (`src/hooks/manager.ts:120–123, 300–325`).

### useWebCutLibrary()
- Purpose: Manage project files.
- Returns: `projectId`, `projectData`, `projectFiles`, `files`, `addNewFile(file)`, `removeFile(fileId)` (`src/hooks/library.ts:51–59`).
- Behavior:
  - Loads project and file list; computes projectFiles by intersecting ids (`src/hooks/library.ts:19–22`).
  - On project change, initializes data and files (`src/hooks/library.ts:24–31`).
  - `addNewFile` deduplicates by MD5, adds to global store and to project relation, refreshes sources (`src/hooks/library.ts:32–43`).
  - `removeFile` updates relation and refreshes (`src/hooks/library.ts:45–49`).

### useWebCutLocalFile()
- Purpose: Create and cache `blob:` URLs for local OPFS files.
- Returns: `applyFileUrl(fileId)`, `fileUrl(fileId)`, `readFile(fileId)` (`src/hooks/local-file.ts:6–55`).
- Behavior: Promise cache per fileId to avoid duplicate reads and produces `URL.createObjectURL(file)`.

#### useWebCutHistory()
- Purpose: Undo/redo/history persistence and recovery.
- Internals:
  - One `HistoryMachine` per project id (`src/hooks/history.ts:12–24`).
  - Persists `rails` and normalized `sources` metas to DB on changes (`src/hooks/history.ts:43–59`).
  - `convertSource` strips live objects and keeps sprite/clip meta (`src/hooks/history.ts:60–84`).
  - `recoverProjectState()` re‑pushes sources and segments into rails from saved state (`src/hooks/history.ts:111–137`).
  - `pushHistory(state)` formats and saves special actions like `materialDeleted` with metadata (`src/hooks/history.ts:139–160`).
  - `undo()` re‑adds deleted material; `redo()` re‑deletes it (`src/hooks/history.ts:162–202`).
  - `clearHistory()` clears machine; `canUndo`, `canRedo`, `canRecover` refs track availability (`src/hooks/history.ts:204–221`).

### Internationalization Hooks

#### useWebCutLocale()
- Purpose: Internationalization language management.
- Source: `src/i18n/hooks`
- Behavior: Provides language switching and localization support, managing multi-language display in the editor.

#### useWebCutTranslate()
- Purpose: Translation function hook.
- Source: `src/i18n/hooks`
- Behavior: Provides simplified translation function interface, supports key-value translation and interpolation, automatically handles language switching.

## Library Functions

### Core Library Functions (`src/libs/index.ts`)
- `renderTxt2ImgBitmap(text, css?, highlights?)` renders HTML styled text to `ImageBitmap` (`src/libs/index.ts:27`).
- `createTxt2Img` creates a text-to-image instance.
- `buildTextAsDOM({ text, css?, highlights? })` builds DOM structure for measurement/rendering (`src/libs/index.ts:86`).
- `cssToText(css)`, `textToCss(text)` convert between object and inline style string (`src/libs/index.ts:248, 276`).
- `measureAudioDuration` measures audio duration.
- `measureImageSize` measures image dimensions.
- `measureTextSize` measures text dimensions.
- `measureVideoDuration` measures video duration.
- `measureVideoSize` measures video dimensions.
- `autoFitRect(canvasSize, elementSize, type?)` returns rect for contain/cover strategies (`src/libs/index.ts:477`).
- `formatTime(ns)` human readable string (`src/libs/index.ts:512`).
- `mp4ClipToBlob` converts MP4 clip to Blob.
- `mp4ClipToFile(clip)` converts MP4 clip to File.
- `audioClipToFile(clip)` converts audio clip to File.
- `pcmToWav(pcmData, sampleRate?)` converts PCM data to WAV format.
- `exportBlobOffscreen` offscreen Blob export.
- `exportAsWavBlobOffscreen` offscreen WAV Blob export.
- `mp4BlobToWavArrayBuffer` converts MP4 Blob to WAV ArrayBuffer.
- `mp4BlobToWavBlob` converts MP4 Blob to WAV Blob.
- `mp4ClipToAudioClip` converts MP4 clip to audio clip.
- `mp4ClipToFramesData` converts MP4 clip to frames data.
- `createImageFromVideoFrame` creates image from video frame.
- `progressiveClipToPCMData` progressively converts clip to PCM data.

### File Helpers (`src/libs/file.ts`)
- `base64ToFile` converts Base64 to File.
- `blobToBase64DataURL` converts Blob to Base64 DataURL.
- `fileToBase64DataURL` converts File to Base64 DataURL.
- `downloadBlob` downloads Blob as file.
- `getFileMd5` gets file MD5 hash.
- `blobToFile` converts Blob to File.

### Database Helpers (`src/db/index.ts`)
- `getProject` gets project information.
- `createNewProject` creates a new project.
- `addFileToProject` adds file to project.
- `removeFileFromProject` removes file from project.
- `writeFile` writes file.
- `readFile` reads file.
- `addFile` adds file.
- `getFile` gets file.
- `getAllFiles` gets all files.
- `moveProjectHistoryTo` moves project history to specific point.
- `pushProjectHistory` pushes new history entry.
- `getProjectHistory` gets project history.
- `clearProjectHistory` clears project history.
- `getProjectState` gets project state.
- `updateProjectState` updates project state.

## Type Definitions

### WebCut Context Types

```typescript
// Main context type
type WebCutContext = {
  // Core state and methods
  video: Ref<WebCutVideo | undefined>
  audio: Ref<WebCutAudio | undefined>
  timeline: Ref<WebCutTimeline | undefined>
  segments: Ref<WebCutSegment[]>
  // ... other context properties
}

// Video-related types
type WebCutVideo = {
  src: string
  width: number
  height: number
  duration: number
  fps: number
  // ... other video properties
}

// Audio-related types
type WebCutAudio = {
  src: string
  duration: number
  volume: number
  // ... other audio properties
}

// Timeline types
type WebCutTimeline = {
  currentTime: number
  duration: number
  zoom: number
  // ... other timeline properties
}

// Segment types
type WebCutSegment = {
  id: string
  start: number
  end: number
  type: 'video' | 'audio'
  // ... other segment properties
}
```

### Animation Types

```typescript
// Animation configuration types
type AnimationConfig = {
  name: string
  duration: number
  delay?: number
  easing?: string
  fill?: 'forwards' | 'backwards' | 'both' | 'none'
}

// Preset animation types
type FadeAnimation = AnimationConfig & {
  type: 'fade'
  direction: 'in' | 'out'
}

type ScaleAnimation = AnimationConfig & {
  type: 'scale'
  from: number
  to: number
}

type SlideAnimation = AnimationConfig & {
  type: 'slide'
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
}
```

### Transition Types

```typescript
// Transition effect types
type TransitionType = 'fade' | 'slide' | 'dissolve' | 'wipe' | 'zoom'

type TransitionConfig = {
  type: TransitionType
  duration: number
  direction?: 'horizontal' | 'vertical'
  easing?: string
}
```

### Filter Types

```typescript
// Filter effect types
type FilterType = 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale'

type FilterConfig = {
  type: FilterType
  value: number
  enabled: boolean
}
```

### Animation Effect Types

```typescript
// Animation effect configuration
type AnimationEffect = {
  id: string
  name: string
  type: 'entrance' | 'exit' | 'emphasis'
  duration: number
  properties: Record<string, any>
}
```

### Internationalization Types

```typescript
// Language configuration
type LocaleConfig = {
  code: string
  name: string
  messages: Record<string, string>
}

// Translation keys
type TranslationKeys = {
  'common.play': string
  'common.pause': string
  'common.stop': string
  'timeline.zoom': string
  'export.title': string
  // ... other translation keys
}
```

### FFmpeg Tool Types

```typescript
// FFmpeg command configuration
type FFmpegCommand = {
  input: string
  output: string
  options: Record<string, any>
  filters?: string[]
}

// FFmpeg progress callback
type FFmpegProgressCallback = (progress: {
  percent: number
  current: number
  total: number
  speed?: number
  eta?: number
}) => void
```

### Export Parameter Types

```typescript
// Export configuration
type ExportConfig = {
  format: 'mp4' | 'webm' | 'avi' | 'mov'
  quality: 'low' | 'medium' | 'high' | 'ultra'
  resolution: {
    width: number
    height: number
  }
  bitrate?: number
  fps?: number
  audioCodec?: string
  videoCodec?: string
}

// Export progress callback
type ExportProgressCallback = (progress: {
  percent: number
  stage: 'processing' | 'encoding' | 'finalizing'
  message?: string
}) => void
```

### Component Property Types

```typescript
// Component props interfaces
interface WebCutProps {
  width?: number
  height?: number
  theme?: 'light' | 'dark'
  locale?: string
  onReady?: () => void
  onError?: (error: Error) => void
}

interface WebCutTimelineProps {
  duration: number
  currentTime: number
  zoom?: number
  onTimeChange?: (time: number) => void
  onSegmentAdd?: (segment: WebCutSegment) => void
  onSegmentRemove?: (id: string) => void
}

interface WebCutPlayerProps {
  src: string
  type: 'video' | 'audio'
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
}
```

### Constants

```typescript
// Application constants
const APP_VERSION = '1.0.0'
const MAX_DURATION = 3600 // 1 hour in seconds
const MIN_SEGMENT_DURATION = 0.1 // 100ms

// Timeline constants
const DEFAULT_ZOOM = 1
const MAX_ZOOM = 10
const MIN_ZOOM = 0.1

// Export constants
const SUPPORTED_FORMATS = ['mp4', 'webm', 'avi', 'mov']
const DEFAULT_QUALITY = 'medium'
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
```

### Loading and Toast Components

```typescript
// Loading component types
type LoadingProps = {
  show: boolean
  message?: string
  size?: 'small' | 'medium' | 'large'
  color?: string
}

// Toast component types
type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastProps = {
  id: string
  type: ToastType
  message: string
  duration?: number
  action?: {
    label: string
    handler: () => void
  }
}
```

### Transition Hooks Types

```typescript
// Transition hook return types
type UseTransitionReturn = {
  isVisible: boolean
  show: () => void
  hide: () => void
  toggle: () => void
  isAnimating: boolean
}

// Transition configuration
type UseTransitionConfig = {
  duration?: number
  delay?: number
  easing?: string
  onShow?: () => void
  onHide?: () => void
}
```

### Toast Hooks Types

```typescript
// Toast hook return types
type UseToastReturn = {
  showToast: (message: string, type?: ToastType) => void
  hideToast: (id: string) => void
  clearToasts: () => void
  toasts: ToastProps[]
}

// Toast configuration
type UseToastConfig = {
  position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  duration?: number
  maxToasts?: number
}
```
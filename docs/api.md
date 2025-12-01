# API Reference

This is a detailed reference for all exports from `src/index.ts`. It explains responsibilities, parameters, return values, events, and internal behaviors, with source locations for quick navigation.

## Components

### WebCutProvider
- Purpose: Provides the `WebCutContext` and UI theme/locale wrappers of Naive UI.
- Props: `{ data?: Partial<WebCutContext> }` (`src/views/provider/index.vue:22`). When provided, merges with defaults and becomes the shared reactive context (`src/hooks/index.ts:20–49`).
- Behavior:
  - Initializes dark/light theme overrides (`src/views/provider/index.vue:37–101`), locale based on `navigator.language` (`src/views/provider/index.vue:103–119`).
  - Provides `VIDEO_CANVAS_CONTEXT` so child components and hooks can consume it (`src/views/provider/index.vue:126`, `src/hooks/index.ts:95`).
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

### WebCutManagerScaler
- Purpose: UI control for timeline scale; changes `scale` used by grid math. Used inside Editor bottom bar (`src/views/editor/index.vue:122–123`).

### WebCutPlayer
- Purpose: Player container used within Editor; delegates to PlayerScreen and PlayerButton (`src/views/editor/index.vue`).

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

### Segment Components
- WebCutVideoSegment / WebCutAudioSegment / WebCutImageSegment / WebCutTextSegment render per‑type segment UI inside Manager slots (`src/views/editor/index.vue:151–155`).

### Panels
- WebCutPanel / WebCutBasicPanel / WebCutTextPanel host editing panels for properties.

### Misc Components
- WebCutTimeClock displays current time. WebCutThemeSwitch toggles dark mode. AdjustableBox / AudioShape / ContextMenu / ScrollBox / DraggableHandler / RotateInput are utility UI components used across panel/manager.

## Hooks

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

Parameters: `WebCutPushMeta` (`src/types/index.ts:119–151`)
- `id?`: custom source key
- `rect?`: `{ x,y,w,h,angle }`
- `time?`: `{ start?, duration?, playbackRate? }`
- `audio?`: `{ volume?, loop? }` only for audio or video with audio
- `video?`: `{ volume? }`
- `text?`: `{ css?, highlights? }` for text rendering
- `zIndex?`: number
- `autoFitRect?`: `'contain'|'cover'|'contain_scale'|'cover_scale'`
- `withRailId?`, `withSegmentId?`: place into a specific rail or segment id (used in history recovery)

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

### useWebCutHistory()
- Purpose: Undo/redo/history persistence and recovery.
- Internals:
  - One `HistoryMachine` per project id (`src/hooks/history.ts:12–24`).
  - Persists `rails` and normalized `sources` metas to DB on changes (`src/hooks/history.ts:43–59`).
  - `convertSource` strips live objects and keeps sprite/clip meta (`src/hooks/history.ts:60–84`).
  - `recoverProjectState()` re‑pushes sources and segments into rails from saved state (`src/hooks/history.ts:111–137`).
  - `pushHistory(state)` formats and saves special actions like `materialDeleted` with metadata (`src/hooks/history.ts:139–160`).
  - `undo()` re‑adds deleted material; `redo()` re‑deletes it (`src/hooks/history.ts:162–202`).
  - `clearHistory()` clears machine; `canUndo`, `canRedo`, `canRecover` refs track availability (`src/hooks/history.ts:204–221`).

## Libs

Key utilities from `src/libs/index.ts`:
- `renderTxt2ImgBitmap(text, css?, highlights?)` renders HTML styled text to `ImageBitmap` (`src/libs/index.ts:27`).
- `buildTextAsDOM({ text, css?, highlights? })` builds DOM structure for measurement/rendering (`src/libs/index.ts:86`).
- `cssToText(css)`, `textToCss(text)` convert between object and inline style string (`src/libs/index.ts:248, 276`).
- `measureVideoSize`, `measureImageSize`, `measureVideoDuration`, `measureAudioDuration`, `measureTextSize` (`src/libs/index.ts:317–409`).
- `exportBlobOffscreen`, `exportAsWavBlobOffscreen`, `mp4BlobToWavBlob` media export/convert (`src/libs/index.ts:420–458`).
- `autoFitRect(canvasSize, elementSize, type?)` returns rect for contain/cover strategies (`src/libs/index.ts:477`).
- `formatTime(ns)` human readable string (`src/libs/index.ts:512`).

## File Helpers (`src/libs/file.ts`)
- `base64ToFile`, `blobToBase64DataURL`, `fileToBase64DataURL`, `downloadBlob`, `getFileMd5`, `blobToFile`.

## Media Helpers (`src/libs/media.ts`)
- `mp4ClipToFile(clip)`, `audioClipToFile(clip)`, `pcmToWav(pcmData, sampleRate?)`.

## Timeline Math (`src/libs/timeline.ts`)
- Grid sizing, pixel/frame conversions, step calculation, format helpers.

## DB (`src/db/index.ts`)
- Project CRUD, file CRUD, history list, project state read/write.

## Types (`src/types/index.ts`)
- `WebCutContext`, `WebCutRail`, `WebCutSegment`, text types, material types, `WebCutPushMeta`, `WebCutSource`, `WebCutSourceMeta`, `HistoryState`.
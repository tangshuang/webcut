# API参考

本参考对 `src/index.ts` 的所有导出做深入说明，覆盖职责、入参、返回值、事件与内部行为，并附源码位置便于跳转。

## 组件

### WebCutProvider
- 功能：提供全局 `WebCutContext`，包裹 Naive UI 的主题与语言 Provider。
- 入参：`{ data?: Partial<WebCutContext> }`（`src/views/provider/index.vue:22`），传入时与默认值合并并注入上下文（`src/hooks/index.ts:20–49`）。
- 行为：
  - 初始化暗/亮主题覆盖（`src/views/provider/index.vue:37–101`），基于 `navigator.language` 设置 `locale`（`src/views/provider/index.vue:103–119`）。
  - 提供 `WEBCUT_CONTEXT` 以便子组件/钩子消费（`src/views/provider/index.vue:126`，`src/hooks/index.ts:95`）。
- 插槽：默认插槽承载编辑器 UI。

### WebCutEditor
- 功能：一体化编辑器视图，组合素材库、播放器、控制区、面板与时间线。
- 入参：`{ projectId?: string }`（`src/views/editor/index.vue:30`），通过 `useWebCutContext` 将 `id` 写入上下文（`src/views/editor/index.vue:34–37`）。
- 行为：
  - 根据布局计算并设置时间线最大高度（`src/views/editor/index.vue:42–46`）。
  - 导出按钮调用 `useWebCutPlayer.download`（`src/views/editor/index.vue:87–93`）。

### WebCutPlayerScreen
- 功能：承载 `AVCanvas` 的视口，并暴露精简播放器 API 与事件总线。
- 入参：`{ maxWidth?: number; maxHeight?: number }`（`src/views/player/screen.vue:6–11`）。
- 暴露：`player.value = { fitBoxSize, on, off, once, emit }`（`src/views/player/screen.vue:73–81`）。可监听 `timeupdate`、`playing`、`paused`、`active`、`change` 等（`src/hooks/index.ts:246–296`）。
- 行为：按容器与可选最大值缩放；窗口尺寸变化自适应（`src/views/player/screen.vue:30–66`）。

### WebCutPlayerButton
- 功能：播放控制；可选前后跳转。
- 入参：`{ displaySkipButtons?: boolean }`（`src/views/player/button.vue:6–8`）。
- 行为：将 `status` −1/0/1 映射到图标与动作（`src/views/player/button.vue:13–22`）；前跳到 `duration - fps`（`src/views/player/button.vue:24–26`）。

### WebCutManager
- 功能：时间线轨与片段编辑容器。
- 入参：`topBarColor?`、`railBgColor?`、`segmentBgColor?`、`segmentBorderColor?`、`segmentHandlerColor?`、`asideWidth?`、`disableEmptyRail?`、`railHeight?`、`railHeightByType?`、`disableSort?`、`disableResize?`（`src/views/manager/index.vue:21–38`）。
- 事件：片段排序/尺寸调整触发 `sort`、`resize`（`src/views/manager/index.vue:18`、`src/views/manager/index.vue:151`）。
- 双向：`maxHeight` 控制内部滚动区域高度（`src/views/manager/index.vue:20`）；公开 `resizeManagerMaxHeight(h)`（`src/views/manager/index.vue:90–93`）。
- 行为：按类型自动计算轨高、左右滚动区联动、具备插槽用于渲染轨侧边与片段（`src/views/manager/index.vue:67–88`, `src/views/manager/index.vue:126–157`）。

### WebCutManagerScaler
- 功能：时间线缩放控制，驱动 `scale` 网格缩放（`src/views/editor/index.vue:122–123`）。

### WebCutPlayer
- 功能：编辑器内部播放器容器，组合 PlayerScreen 与 PlayerButton。

### WebCutSelectAspectRatio
- 功能：按预设比例更新画布尺寸。
- 入参：`{ displayAspect?: boolean }`（`src/views/select-aspect-ratio/index.vue:14–17`）。
- 行为：
  - 比较 `width/height` 与预设比例以展示当前比例（`src/views/select-aspect-ratio/index.vue:74–86`）。
  - 选择时写入 `width/height`（`src/views/select-aspect-ratio/index.vue:89–95`）。
  - 选项包括 `21:9`、`16:9`、`4:3`、`9:16`、`3:4`、`1:1` 的具体目标尺寸（`src/views/select-aspect-ratio/index.vue:64–72`）。

### WebCutLibrary
- 功能：项目素材库，支持列表、添加、删除（`src/hooks/library.ts:14–59`）。

### 片段组件
- WebCutVideoSegment / WebCutAudioSegment / WebCutImageSegment / WebCutTextSegment 在 Manager 插槽中按类型渲染（`src/views/editor/index.vue:151–155`）。

### 面板
- WebCutPanel / WebCutBasicPanel / WebCutTextPanel 承载属性编辑。

### 其他组件
- WebCutTimeClock 显示当前时间；WebCutThemeSwitch 控制暗色模式；AdjustableBox / AudioShape / ContextMenu / ScrollBox / DraggableHandler / RotateInput 为通用 UI 组件。

## 钩子

### useWebCutContext(providedContext?: Partial<WebCutContext>)
- 功能：提供/消费响应式的编辑器状态。根组件传入 `providedContext` 时创建并提供，否则注入或构造默认值（`src/hooks/index.ts:19–65`，`src/hooks/index.ts:95`）。
- 默认值（`src/hooks/index.ts:20–45`）：
  - `id`、`width`、`height`、`viewport: HTMLDivElement|null`、`canvas: AVCanvas|null`
  - `clips: MP4Clip|ImgClip|AudioClip[]`、`sprites: VisibleSprite[]`、`sources: Map<string, WebCutSource>`
  - `cursorTime`（纳秒）、`status: -1|0|1`（停/暂/播）（`src/types/index.ts:24–27`）
  - `disableSelectSprite`、`autoResetWhenStop`
  - `fps`、`scale`（时间线缩放 [0,100]）
  - 时间线引用：`scroll1`、`scroll2`、`ruler`、`manager`、`player`
  - `rails: WebCutRail[]`、选中 `selected[]`、当前 `current: string|null`、撤销/重做标记
- 派生/计算（`src/hooks/index.ts:66–174`）：
  - `duration` 由 sprites 结束时间计算；当 `status` 停止且游标仍在范围内时自动切到暂停（`src/hooks/index.ts:66–93`）。
  - `currentRail`、`currentSegment`、`currentSource` 由选中状态计算（`src/hooks/index.ts:132–174`）。
- 操作（`src/hooks/index.ts:97–130`）：
  - `toggleSegment(segmentId, railId)`、`selectSegment`、`unselectSegment` 维护选中。
- 返回：所有引用、`duration`、`updateDuration`、`provide()`、选中操作与当前 getter（`src/hooks/index.ts:176–189`）。

### useWebCutPlayer()
- 功能：播放器与媒体操作，绑定上下文与 `AVCanvas`。
- 画布生命周期/事件（`src/hooks/index.ts:232–301`）：
  - `init()` 创建画布、加入现有 sprites、监听并转发 `timeupdate`、`playing`、`paused`、`activeSpriteChange`，并与 `sources` 同步选中。
  - `play()`、`pause()`、`reset()` 控制播放与游标（`src/hooks/index.ts:303–328`）。
  - `moveTo(timeNs)` 定位预览但不播放（`src/hooks/index.ts:760–767`）。
  - `resize()` 触发 PlayerScreen 重新自适应（`src/hooks/index.ts:783–785`）。
- 导出（`src/hooks/index.ts:330–351`）：`exportBlob()` 从合成器流出 MP4；`exportAsWavBlob()` 通过 `mp4BlobToWavBlob` 转 WAV。
- 素材（`src/hooks/index.ts:353–564`）：
  - `push(type, source, meta)` 支持 `video|audio|image|text` 来源：`File`、`data:URL`、`file:<id>`、`http(s)`。处理音量、图片/视频自动适配、默认时长（图/文 2s）、zIndex、时间偏移等。
  - 创建 `VisibleSprite` 并写入 `sources`（包含 `fileId/url/text/segmentId/railId/meta`）（`src/hooks/index.ts:547–559`）。
  - 轨道分配：按类型自动建轨、视频轨标记 `main`，遇到交叠自动新增轨并重排（`src/hooks/index.ts:508–545`）。
  - `remove(key)`、`clear()`、`destroy()` 负责销毁与清理（`src/hooks/index.ts:566–633`）。
- 文本工具（`src/hooks/index.ts:634–758`）：
  - `initTextMaterial(text, css?, highlights?)` 渲染文本位图，计算位置与旋转（`--transform-rotate`），并规范 CSS（`src/hooks/index.ts:634–691`）。
  - `updateText(key, { text?, css?, highlights? })` 用保持时间/属性的新 `ImgClip` 替换旧 sprite，并更新 `sources.meta.text`（`src/hooks/index.ts:699–758`）。
- 其他：
  - `captureImage()` 返回当前帧图像（`src/hooks/index.ts:769–772`）。
  - `readSources()` 返回 `Map<string, WebCutSource>`（`src/hooks/index.ts:774–776`）。
  - `download(filename?)` 导出 MP4 并触发下载（`src/hooks/index.ts:778–781`）。

参数：`WebCutMaterialMeta`（`src/types/index.ts:119–151`）
- `id?`：自定义素材 key
- `rect?`：`{ x,y,w,h,angle }`
- `time?`：`{ start?, duration?, playbackRate? }`
- `audio?`：`{ volume?, loop? }`（音频或含音轨视频）
- `video?`：`{ volume? }`
- `text?`：`{ css?, highlights? }`（文本渲染）
- `zIndex?`：图层顺序
- `autoFitRect?`：`'contain'|'cover'|'contain_scale'|'cover_scale'`
- `withRailId?`、`withSegmentId?`：放入指定轨/片段（用于历史恢复）

### useWebCutManager()
- 功能：时间线计算与片段操作（`src/hooks/manager.ts`）。
- 游标与网格：
  - `totalFrameCount`、`totalPx`、`cursorFrame`、`cursorPx`（`src/hooks/manager.ts:34–55`）。
  - `moveCursorToTime(ns)`、`moveCursorToFrame(frame)`、`moveCursorToPx(px)` 预览并暂停（`src/hooks/manager.ts:68–87`）。
  - `timeToPx(ns)`、`pxToTime(px)`、`pxOf1Frame`、`timeOf1Frame`（`src/hooks/manager.ts:89–107`）。
- 片段：
  - `resetSegmentTime(segment)` 写回 sprite 时间并更新总时长（`src/hooks/manager.ts:109–119`）。
  - `toggleRailHidden(rail)` 统一隐藏/显示轨上所有 sprite（`src/hooks/manager.ts:125–136`）。
  - `toggleRailMute(rail)` 通过设置 `clip.tickInterceptor` 屏蔽音频数据（`src/hooks/manager.ts:138–158`）。
  - `deleteSegment({ segment, rail })` 销毁并移除片段，轨为空则移除，清除选中（`src/hooks/manager.ts:160–179`）。
  - `splitSegment({ segment, rail, keep })` 以游标时间切分：视频/音频进行编解码切分并以文件重新推入；图片/文本复制片段并调整时间；保留 `tickInterceptor`（`src/hooks/manager.ts:181–298`）。
- 滚动联动与居中（`src/hooks/manager.ts:13–32, 56–66`）。
- 返回：`scroll1`、`scroll2`、`ruler` 与 `resizeManagerMaxHeight(h)`（`src/hooks/manager.ts:120–123, 300–325`）。

### useWebCutLibrary()
- 功能：项目文件管理。
- 返回：`projectId`、`projectData`、`projectFiles`、`files`、`addNewFile(file)`、`removeFile(fileId)`（`src/hooks/library.ts:51–59`）。
- 行为：
  - 加载项目与文件列表；通过 id 交集得出项目文件（`src/hooks/library.ts:19–22`）。
  - 项目变更时初始化数据与文件（`src/hooks/library.ts:24–31`）。
  - `addNewFile` 以 MD5 去重，添加到全局与项目关系并刷新（`src/hooks/library.ts:32–43`）。
  - `removeFile` 更新关系并刷新（`src/hooks/library.ts:45–49`）。

### useWebCutLocalFile()
- 功能：为本地 OPFS 文件生成并缓存 `blob:` URL。
- 返回：`applyFileUrl(fileId)`、`fileUrl(fileId)`、`readFile(fileId)`（`src/hooks/local-file.ts:6–55`）。
- 行为：为每个 fileId 维护 Promise 缓存，避免重复读取；成功后持久化 `url`。

### useWebCutHistory()
- 功能：撤销/重做与历史持久化/恢复。
- 实现：
  - 每个项目一个 `HistoryMachine`（`src/hooks/history.ts:12–24`）。
  - 监听 `rails` 与规范化的 `sources` 保存到 DB（`src/hooks/history.ts:43–59`）。
  - `convertSource` 将运行时对象转为可存的 meta（`src/hooks/history.ts:60–84`）。
  - `recoverProjectState()` 从保存状态重新推入素材与片段（`src/hooks/history.ts:111–137`）。
  - `pushHistory(state)` 格式化并保存特定操作如删除（`src/hooks/history.ts:139–160`）。
  - `undo()` 重新添加删除素材；`redo()` 再次删除（`src/hooks/history.ts:162–202`）。
  - `clearHistory()` 清空；`canUndo`、`canRedo`、`canRecover` 反映可用性（`src/hooks/history.ts:204–221`）。

## 库

`src/libs/index.ts` 关键函数：
- `renderTxt2ImgBitmap(text, css?, highlights?)` 文本渲染成位图（`src/libs/index.ts:27`）。
- `buildTextAsDOM({ text, css?, highlights? })` 构建渲染 DOM（`src/libs/index.ts:86`）。
- `cssToText`、`textToCss` 在对象与样式文本间转换（`src/libs/index.ts:248, 276`）。
- `measureVideoSize`、`measureImageSize`、`measureVideoDuration`、`measureAudioDuration`、`measureTextSize`（`src/libs/index.ts:317–409`）。
- `exportBlobOffscreen`、`exportAsWavBlobOffscreen`、`mp4BlobToWavBlob` 导出/转换（`src/libs/index.ts:420–458`）。
- `autoFitRect(canvasSize, elementSize, type?)` 返回 contain/cover 方案的矩形（`src/libs/index.ts:477`）。
- `formatTime(ns)` 友好时间字符串（`src/libs/index.ts:512`）。

## 文件工具（`src/libs/file.ts`）
- `base64ToFile`、`blobToBase64DataURL`、`fileToBase64DataURL`、`downloadBlob`、`getFileMd5`、`blobToFile`。

## 媒体工具（`src/libs/index.ts`）
- `mp4ClipToFile(clip)`、`audioClipToFile(clip)`、`pcmToWav(pcmData, sampleRate?)`。

## 时间线计算（`src/libs/timeline.ts`）
- 网格尺寸、像素/帧换算、步进计算、格式化。

## 数据库（`src/db/index.ts`）
- 项目 CRUD、文件 CRUD、历史列表、项目状态读写。

## 类型（`src/types/index.ts`）
- `WebCutContext`、`WebCutRail`、`WebCutSegment`、文本类型、素材类型、`WebCutMaterialMeta`、`WebCutSource`、`WebCutSourceMeta`、`WebCutHistoryState`。
# 钩子（Hooks）

用于控制画布、时间线、素材与历史的组合式 API。

## useWebCutContext

提供项目上下文与选中状态（见 `src/types/index.ts:4`）。

- 字段包括 `width`、`height`、`canvas`、`clips`、`sprites`、`sources`、`cursorTime`、`status`、`fps`、`scale`、`rails`、`selected`、`current`
- 独立使用钩子时，在顶层调用 `provide()` 提供上下文（见 `src/hooks/index.ts:182`）

## useWebCutPlayer

核心媒体操作（见 `src/hooks/index.ts:788`）。

- 播放控制：`init`、`play`、`pause`、`reset`、`moveTo`
- 推入素材：`push(type, source, meta)`，`WebCutMaterialMeta` 定义见 `src/types/index.ts:119`
- 清理与销毁：`remove(key)`、`clear()`、`destroy()`
- 导出：`exportBlob()`、`exportAsWavBlob()`、`download(filename)`
- 文本更新：`updateText(key, data)` 重新渲染文本为位图（见 `src/hooks/index.ts:699`）
- 其他：`captureImage()`、`resize()`

## useWebCutManager

时间线工具（见 `src/hooks/manager.ts:9`）。

- 光标：`moveCursorToTime`、`moveCursorToFrame`、`moveCursorToPx`
- 转换：`timeToPx`、`pxToTime`、`pxOf1Frame`、`timeOf1Frame`
- 片段：`resetSegmentTime`、`splitSegment`、`deleteSegment`
- 轨：`toggleRailHidden`、`toggleRailMute`、`resizeManagerMaxHeight`

## useWebCutLibrary

项目文件管理（见 `src/hooks/library.ts:14`）。

- `projectFiles`、`files` 列表
- `addNewFile(file)`、`removeFile(fileId)`

## useWebCutLocalFile

解析本地文件 URL（见 `src/hooks/local-file.ts:6`）。

- `applyFileUrl(fileId)`、`fileUrl(fileId)`、`readFile(fileId)`

## useWebCutHistory

通过 `HistoryMachine` 持久化并恢复（见 `src/hooks/history.ts:14`）。

- `pushHistory(state)`、`undo()`、`redo()`、`clearHistory()`
- `canUndo`、`canRedo`、`canRecover`、`recoverProjectState()`

## 类型

`src/types/index.ts` 中的关键类型：

- `WebCutContext` — 编辑器状态
- `WebCutRail`、`WebCutSegment` — 时间线数据
- `WebCutMaterialMeta` — 推入素材选项
- `WebCutSource`、`WebCutSourceMeta` — 素材映射与持久化
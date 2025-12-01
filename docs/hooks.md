# Hooks

Composable APIs to control canvas, timeline, assets, and history.

## useWebCutContext

Provides the reactive project context and selection state.

- Fields include `width`, `height`, `canvas`, `clips`, `sprites`, `sources`, `cursorTime`, `status`, `fps`, `scale`, `rails`, `selected`, `current` (see `src/types/index.ts:4`).
- Call `provide()` once at top-level when using hooks standalone (see `src/hooks/index.ts:182`).

## useWebCutPlayer

Core media operations (see `src/hooks/index.ts:788`).

- `init`, `play`, `pause`, `reset`, `moveTo` — player control
- `push(type, source, meta)` — add media/text with `WebCutPushMeta` (see `src/types/index.ts:119`)
- `remove(key)`, `clear()`, `destroy()` — teardown
- `exportBlob()`, `exportAsWavBlob()` — export MP4/WAV
- `updateText(key, data)` — re-render text as bitmap (see `src/hooks/index.ts:699`)
- `download(filename)`, `captureImage()`, `resize()`

## useWebCutManager

Timeline utilities (see `src/hooks/manager.ts:9`).

- Cursor: `moveCursorToTime`, `moveCursorToFrame`, `moveCursorToPx`
- Conversions: `timeToPx`, `pxToTime`, `pxOf1Frame`, `timeOf1Frame`
- Segment ops: `resetSegmentTime`, `splitSegment`, `deleteSegment`
- Rails: `toggleRailHidden`, `toggleRailMute`, `resizeManagerMaxHeight`

## useWebCutLibrary

Project files from OPFS-backed storage (see `src/hooks/library.ts:14`).

- `projectFiles`, `files` — computed lists
- `addNewFile(file)`, `removeFile(fileId)`

## useWebCutLocalFile

Resolve blob URLs for locally stored files (see `src/hooks/local-file.ts:6`).

- `applyFileUrl(fileId)`, `fileUrl(fileId)`, `readFile(fileId)`

## useWebCutHistory

Persist and restore via `HistoryMachine` (see `src/hooks/history.ts:14`).

- `pushHistory(state)`, `undo()`, `redo()`, `clearHistory()`
- `canUndo`, `canRedo`, `canRecover`, `recoverProjectState()`

## Types

Key types in `src/types/index.ts`:

- `WebCutContext` — editor state
- `WebCutRail`, `WebCutSegment` — timeline data
- `WebCutPushMeta` — push options
- `WebCutSource`, `WebCutSourceMeta` — source mapping and persistence
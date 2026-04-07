# WebCut 历史系统重构记录（2026-04-05）

## 1. 背景与问题

本次重构前，WebCut 历史系统主要基于全量快照（`rails + sources`）做撤销/重做与恢复，存在以下问题：

1. 历史数据语义不足：只有 `state`，缺少“本次改动是什么”“如何撤销该改动”等结构化信息。
2. 交互能力不足：`history-recover` 工具仅能恢复初始化状态，不能按历史条目跳转。
3. current 指针缺失：历史列表无法直观看到当前历史位置。
4. 撤销/重做实现耦合快照：无法优先基于 patch 做最小变更。
5. 分支历史管理需强化：当 current 位于中间且发生新编辑时，需要明确截断后续历史并重建分支。

## 2. 重构目标

围绕“可维护、可扩展、可视化”重构历史系统，目标如下：

1. 抽象统一历史记录结构，至少包含：
   - 本次变更 patch（同时用于 redo）
   - 本次变更后的完整镜像 snapshot
   - 撤销本次变更所需 undoPatch
   - 可展示 title
2. 在编辑器数据完成变更后，统一 push 历史。
3. 提供易用 hooks，支持：
   - 快照抓取
   - 自动构建 entry
   - 历史列表读取
   - 按历史 id 恢复
   - undo/redo 与 current 同步

## 3. 数据结构改造

### 3.1 类型新增

文件：`src/types/index.ts`

新增：

- `WebCutProjectHistoryPatchOperation`
  - `setRails`
  - `upsertSource`
  - `removeSource`
- `WebCutProjectHistoryPatch`
- `WebCutProjectHistoryPushPayload`

### 3.2 历史记录结构升级

`WebCutProjectHistoryData` 增加字段：

- `current?: boolean`：当前指针标识
- `title: string`：展示标题
- `patch: WebCutProjectHistoryPatch`：本次变更 patch（redo patch）
- `undoPatch: WebCutProjectHistoryPatch`：撤销 patch
- `snapshot: WebCutProjectHistoryState`：变更后的完整镜像
- `state`：保留兼容字段（旧版本字段）

## 4. Patch 引擎实现

文件：`src/libs/history-patch.ts`（新增）

提供能力：

1. `createHistoryPatches(before, after)`
   - 自动比较前后状态
   - 生成 `patch`（before -> after）
   - 生成 `undoPatch`（after -> before）
2. `applyHistoryPatch(base, patch)`
   - 基于 patch 纯函数生成下一状态
3. `createEmptyPatch()`
   - 兼容旧逻辑与默认值

## 5. DB 层改造

文件：`src/db/index.ts`

### 5.1 新增接口

1. `pushProjectHistoryEntry(projectId, payload)`
   - 写入完整历史结构（title/patch/undoPatch/snapshot）
2. `moveProjectHistoryToId(projectId, historyId)`
   - 指针跳转到指定历史项

### 5.2 current 标记维护

新增内部函数：`updateProjectHistoryCurrent(projectId, historyId)`

- 将目标历史项置 `current = true`
- 其余历史项置 `current = false`
- 在以下场景自动触发：
  - push 新历史
  - undo/redo
  - moveToId

### 5.3 project_state 更新修复

`updateProjectState` 由“truthy 判断”改为“key 是否存在判断”：

- `historyAt` 支持写空字符串（清空指针）
- `aspectRatio` 支持按字段语义更新

### 5.4 分支历史截断

push 历史时若 current 不在尾部，删除 current 之后历史，保留 current 之前历史，再写入新记录。

该逻辑在 `pushProjectHistory` 与 `pushProjectHistoryEntry` 中均生效。

## 6. HistoryMachine 改造

文件：`src/libs/history-machine.ts`

新增/调整：

1. 内部缓存 `currentHistoryData`
2. `getCurrentHistory()`
3. `getCurrentState()`
4. `moveTo(historyId)`：按 id 跳转
5. `push()` 支持 `WebCutProjectHistoryPushPayload`
6. `undo()/redo()` 返回完整 `WebCutProjectHistoryData`

## 7. Hook 层改造

文件：`src/hooks/history.ts`

### 7.1 新增对外能力

- `historyList`
- `refreshHistoryList()`
- `recoverToHistory(historyId)`
- `snapshot()`
- `createEntry({ title, before, after })`

### 7.2 push 逻辑

- 默认采集当前快照作为 after
- 自动拿当前 historyState 作为 before
- 自动生成 patch/undoPatch
- patch 与 undoPatch 均为空时不入历史（避免脏记录）

### 7.3 undo/redo 逻辑

- `undo()`：优先使用“当前记录”的 `undoPatch` 应用
- `redo()`：优先使用“目标记录”的 `patch` 应用
- patch 缺失时回退到 snapshot/state 恢复（兼容旧数据）

### 7.4 列表同步

在 recover、recoverToHistory、push、undo、redo、clear 后刷新 `historyList`。

## 8. 工具组件改造

### 8.1 历史恢复工具

文件：`src/views/tools/history-recover/index.vue`

改造点：

1. 点击按钮打开下拉弹层（`NPopover trigger=click`）
2. 展示完整历史列表（按时间顺序）
3. 每项展示：`title + timestamp`
4. 点击某项后调用 `recoverToHistory(id)` 做整镜像覆盖
5. 当前项前显示箭头（依赖 `item.current`）

### 8.2 删除工具时序修正

文件：`src/views/tools/delete/index.vue`

由“先 push 再 delete”改为“先 delete 再 push”，并增加标题：`删除片段`。

## 9. 导出层改造

文件：`src/index.ts`

新增导出：

- `pushProjectHistoryEntry`
- `moveProjectHistoryToId`
- 新增 history patch 相关类型导出

## 10. 关键流程说明

### 10.1 点击历史项恢复

1. UI 调用 `recoverToHistory(historyId)`
2. `HistoryMachine.moveTo(historyId)` 更新 DB 指针
3. DB 将对应记录 `current=true`
4. Hook 使用目标 `snapshot` 覆盖编辑器全量状态
5. 刷新 `canUndo/canRedo/historyList`

### 10.2 点击撤销

1. 获取当前快照（before）
2. 调用 `HistoryMachine.undo()`，指针前移并更新 current
3. 使用“原当前记录”的 `undoPatch` 应用到 before 得到 after
4. 将 after 覆盖到编辑器
5. 刷新历史列表

### 10.3 点击重做

1. 获取当前快照（before）
2. 调用 `HistoryMachine.redo()`，指针后移并更新 current
3. 使用“目标记录”的 `patch` 应用到 before 得到 after
4. 将 after 覆盖到编辑器
5. 刷新历史列表

### 10.4 current 位于中间后继续编辑

1. push 前依据 `historyAt` 找 current
2. 清除 current 之后所有历史
3. 写入新历史并标记为 `current=true`
4. 后续 redo 不可用（符合分支切换预期）

## 11. 兼容策略

1. 历史记录保留 `state` 字段，兼容旧版本读取。
2. undo/redo 在 patch 不可用时回退到 snapshot/state 恢复。
3. push 旧接口仍可用（内部补默认 patch/snapshot/title）。

## 12. 修改文件清单

1. `src/types/index.ts`
2. `src/libs/history-patch.ts`（新增）
3. `src/db/index.ts`
4. `src/libs/history-machine.ts`
5. `src/hooks/history.ts`
6. `src/views/tools/history-recover/index.vue`
7. `src/views/tools/delete/index.vue`
8. `src/index.ts`

## 13. 验证

执行：`yarn typecheck`

结果：通过。

## 14. 后续建议

1. 为常见操作统一 title 常量（删除、分割、移动、属性编辑等），提升历史可读性。
2. 增加 `history` 相关单测：
   - patch 生成正确性
   - undo/redo 指针与 current 标记一致性
   - 中间分支 push 的截断行为
3. 在历史列表中增加分组（按分钟/操作类型）和筛选，提升大型项目可用性。

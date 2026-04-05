# WebCut VideoFrame 内存优化调研与治理建议

- 调研日期：2026-04-05
- 调研范围：`opensource/webcut/src` 运行时代码（不含 `documents/` 示例文档）
- 调研目标：定位 `VideoFrame` 使用热点、生命周期缺口与可落地优化路径，缓解长时间编辑导致的内存增长问题

## 1. 结论摘要

当前项目里 `VideoFrame` 的核心风险不在“是否使用”，而在“所有权不清 + 临时帧未统一回收”。

高优先级问题主要集中在 4 个点：

1. 转场 `tickInterceptor` 每帧创建多个临时 `VideoFrame`，但没有 `finally` 统一 `close()`，存在持续累积风险。
2. 转场中缓存了 `ImageBitmap`（首帧/尾帧），生命周期结束时未显式 `close()`。
3. `mp4ClipToFramesData` 在无回调场景也会收集 `VideoFrame[]`，调用方若只取 `pcm` 会造成帧对象悬挂。
4. 图片片段导出流程 `clip.tick()` 得到 `VideoFrame` 后未释放。

## 2. 使用点分布（src 实码）

按命中量（`VideoFrame|new VideoFrame|clone|close`）统计：

- `src/modules/transitions/effects-transitions.ts`：21（转场输出帧生成）
- `src/modules/filters/css-filters.ts`：14（滤镜帧处理）
- `src/modules/transitions/transition-manager.ts`：11（转场调度）
- `src/libs/index.ts`：10（抽帧与工具函数）
- `src/hooks/transition.ts`：9（转场拼接与拦截器）
- `src/hooks/index.ts`：5（主播放链路拦截器）

说明：大量命中本身不等于泄漏，重点看“创建后的所有权与关闭时机”。

## 3. 生命周期审计（重点文件）

## 3.1 正向样例（目前做得好的）

### A. 主播放滤镜链路有 `finally` 兜底释放

- 文件：`src/hooks/index.ts:493-523`
- 现状：`result.video` 是 `VideoFrame` 时，处理完后无论成功失败都会 `originalFrame.close()`。

这条链路是当前项目里最接近“正确模式”的实现。

### B. 缩略图生成回调中主动关闭帧

- 文件：`src/views/manager/segments/video.vue:102-120`
- 现状：每次 `createImageFromVideoFrame` 后立即 `video.close()`，避免缩略图流程堆积帧对象。

---

## 3.2 高风险点（建议 P0 / P1）

### P0-1 转场拦截器临时帧未统一回收

- 文件：`src/hooks/transition.ts:77-119`
- 问题细节：
  - 每 tick 都可能创建：
    - `clip1Frame/clip2Frame`（ImageBitmap -> VideoFrame）
    - `clip2FirstFrame/clip1LastFrame`（缓存位图 -> VideoFrame）
  - `transitionManager.applyTransition(...)` 后直接返回新帧，未对上述输入帧做 `close()`。
  - 若 `ret.video` 原本是 `VideoFrame` 并被替换，也应明确关闭旧帧。

风险：播放时持续创建临时帧，长时间预览/拖动后内存持续上升。

### P0-2 转场缓存位图无销毁钩子

- 文件：`src/hooks/transition.ts:58-71`
- 问题细节：
  - `clip2FirstImageBitmap`、`clip1LastImageBitmap` 在闭包内长期持有。
  - `removeTransition` 只销毁 `clip/sprite`，没有显式 `ImageBitmap.close()`。

风险：多次增删转场后，位图资源回收滞后或不及时。

### P1-1 抽帧接口在“只要音频”场景仍持有视频帧

- 文件：`src/libs/index.ts:878-1001`
- 问题细节：
  - `mp4ClipToFramesData` 无论是否需要，都会 `frames.push({ video, ts })`。
  - 调用方 `mp4ClipToAudioClip` 仅取 `pcm`（`src/libs/index.ts:1133-1134`），未消费 `frames`。
  - 这会把 `VideoFrame` 生命周期交给 GC，而不是显式 `close()`。

风险：接口语义和资源语义不一致，属于隐藏型内存坑。

### P1-2 图片导出未关闭 tick 得到的帧

- 文件：`src/views/manager/segments/image.vue:59-82`
- 问题细节：
  - `clip.tick(1)` 返回的 `video` 参与绘制后，没有 `video.close()`。

风险：单次影响小，但频繁导出会形成积累。

## 4. 优化建议（可直接落地）

## 4.1 建立统一所有权规则（必须先做）

建议在团队内固定以下约定：

1. 谁 `new VideoFrame` / `clone()`，谁负责 `close()`。
2. 传入第三方处理函数前，默认“不转移所有权”；除非接口文档明确说明接管。
3. `tickInterceptor` 替换 `ret.video` 时，必须关闭旧帧（在 `finally` 中做）。
4. `ImageBitmap` 作为长期缓存时，必须配套 `dispose`/`teardown` 关闭。

## 4.2 优先改造转场拦截器（P0）

核心做法：

- 在两个 `tickInterceptor` 里使用 `try/finally`，保证临时输入帧全部关闭。
- 仅对“新建帧”做关闭，避免重复关闭非本地所有权对象。
- 在 `removeTransition` 时显式释放缓存位图。

参考模式（示意）：

```ts
const tempFrames: VideoFrame[] = [];
try {
  const from = clip1Video instanceof ImageBitmap
    ? (tempFrames.push(new VideoFrame(clip1Video, { timestamp })), tempFrames[tempFrames.length - 1])
    : clip1Video;

  const to = new VideoFrame(clip2FirstImageBitmap, { timestamp });
  tempFrames.push(to);

  const out = await transitionManager.applyTransition(from, to, progress, name, config);
  if (ret.video instanceof VideoFrame && ret.video !== out) {
    ret.video.close();
  }
  return { ...ret, video: out, audio: [] };
} finally {
  for (const f of tempFrames) f.close();
}
```

同时将 `Date.now()` 替换为源帧时间戳（`clipXVideo.timestamp`）或按 `time` 推导的微秒值，避免时间轴抖动。

## 4.3 重构 `mp4ClipToFramesData` 的接口语义（P1）

建议新增配置：

- `collectFrames?: boolean`（默认 `false`）
- `iteratorCallback` 存在时按需回调，但默认不持有 `frames[]`

推荐行为：

1. 若 `collectFrames=false`，采到视频帧后：
   - 有回调则回调后立刻 `video.close()`（或约定回调负责关闭并强约束）
   - 无回调则立即 `video.close()`
2. 若 `collectFrames=true`，明确由调用方负责关闭返回帧。

这样可以避免 `mp4ClipToAudioClip` 这种“只要音频”路径无意中持有视频帧。

## 4.4 低成本补丁（当天可完成）

1. `src/views/manager/segments/image.vue`：导出后 `finally` 关闭 `video`（含 VideoFrame / ImageBitmap）。
2. 转场移除逻辑中增加对缓存 `ImageBitmap` 的 `close()`。
3. 在开发环境加帧计数埋点：创建数、关闭数、当前活跃数（`created - closed`）。

## 5. 分阶段治理计划

## 阶段 1（1~2 天，止血）

1. 修复 `hooks/transition.ts` 拦截器临时帧回收。
2. 修复 `image.vue` 导出流程释放。
3. 给 `mp4ClipToFramesData` 增加 `collectFrames`，默认不收集。

验收标准：

- 连续 15 分钟播放 + 反复拖拽 + 开关转场，内存曲线不再线性上升。
- `activeVideoFrame` 计数在暂停后回落到稳定区间。

## 阶段 2（3~5 天，稳态优化）

1. 统一封装 `withVideoFrame` / `safeCloseFrame` 工具，替换散落的 `close`。
2. 规范所有 `tickInterceptor` 的所有权模板。
3. 对滤镜/转场链路增加异常分支回收测试。

验收标准：

- 人工制造异常（滤镜抛错、转场抛错）后，`created/closed` 计数仍可闭合。

## 阶段 3（持续，体验优化）

1. 在性能面板展示帧资源统计。
2. 评估将部分预览链路从 `VideoFrame` 改为 `ImageBitmap`（只读预览场景）以降低帧对象压力。

## 6. 建议新增的工程守卫

1. ESLint 自定义规则（或简单脚本）：检测 `new VideoFrame` 同函数内是否存在 `close()` 路径。
2. PR 模板增加检查项：
   - 是否新增 `VideoFrame` 创建点？
   - 对应回收策略是什么？
3. 关键 API 文档化：明确“调用方负责释放”还是“内部释放”。

## 7. 关键文件索引

- `src/hooks/transition.ts:58-119`
- `src/hooks/index.ts:493-523`
- `src/libs/index.ts:878-1001`
- `src/libs/index.ts:1133-1134`
- `src/views/manager/segments/image.vue:59-82`
- `src/views/manager/segments/video.vue:102-120`


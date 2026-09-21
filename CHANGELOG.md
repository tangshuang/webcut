# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [Unreleased]

### Features

* 画布预览区新增缩放控制（`WebCutSelectZoom`，播放器底部按钮区最左）：点击弹出 popover 滑块调节 25%~400%（步长 5%），popover 内支持鼠标滚轮调节（上滚放大/下滚缩小），一键重置回适配屏幕（100%）；缩放为会话级状态（`context.canvasZoom`）不做持久化，编辑器重开自动恢复适配；组件三端同步导出（ESM / `<webcut-select-zoom>` / React 桥接） (2026-09-21)
* 缩放产生溢出后支持拖拽平移查看画布细节：滚动条以 overflow:hidden 隐藏（scrollLeft/scrollTop 编程滚动），按住鼠标中键或「空格+鼠标左键」拖动平移，仅当前缩放实际产生溢出时生效（按下时实时测量），画布拖拽不触发素材选中/移动（box 捕获阶段拦截 pointerdown）；空格监听排除输入框/文本编辑场景，窗口失焦兜底复位；拖拽开始时经 context 事件 `canvasPanStart` 自动收起缩放 popover；居中改用 margin:auto 避免 flex 居中溢出裁切（顶部/左侧始终可达） (2026-09-21)
* FPS 帧率选项从播放器底部按钮区迁移至底部轨道区顶部工具条最右侧（时间轴缩放工具右侧） (2026-09-21)
* 重构历史记录（undo/redo）系统：历史操作（push/undo/redo/恢复）全部经每项目串行队列执行，彻底消除并发交错；undo/redo 直接使用目标历史条目的完整快照恢复，不再从运行态反推 (2026-08-17)
* 新增 source 驻留池（`src/hooks/source-park.ts`）：撤销/重做/删除恢复时优先复用已构建的素材（不销毁 clip/sprite），避免反复创建/销毁解码器导致的内存压力与素材恢复失败 (2026-08-17)
* 新增手势事务 API：`useWebCutHistory` 返回 `touch/beginTransaction/commitTransaction/cancelTransaction`，连续调整（滑杆/拖拽/文本输入）静默后合并为一条历史；画布拖拽可通过新导出的 `requestHistoryTouch` 显式打点，不再依赖属性面板的隐式副作用 (2026-08-17)
* 历史存储分表（DB v8）：历史列表行只保留轻量数据，全量快照独立存于 `project_history_snapshot`，旧数据读取时自动迁移，显著降低每次历史操作的 IO 与存储体积 (2026-08-17)
* 历史记录恢复引擎分级应用：位置/时长/变速/滤镜/动画/音量等属性变化一律原地更新 sprite 与 meta，仅素材身份变化（类型/文件/入点/文本内容）才重建 (2026-08-17)
* 编辑器画布右下角（比例切换左侧）新增分辨率切换：1080P/768P/720P/576P/544P/540P/480P/360P 共 8 档，切换实时调整画布尺寸且不影响素材原始尺寸；与比例切换联动（切比例保持档位、切档位保持比例），档位随项目状态持久化、刷新后恢复；导出面板默认分辨率跟随画布档位，选项同步扩展至全部档位（新增 `WebCutSelectResolution` 组件与 `updateByResolution` API） (2026-09-02)
* `WebCutEditor` 新增 `aspectRatio` / `resolution` props：进入编辑器时按宿主传入的比例与分辨率档位初始化画布并持久化；项目已有持久化选择（用户上次手动切换）时以用户选择为准（webcomponents 形式经 attribute 同样可用） (2026-09-03)
* 画布长宽比提升为 context 一等状态（`aspectRatio` + 会话级 `canvasPresetLocked` 标志）：宽高永远是「分辨率+长宽比」查表的派生值，消除运行时反推——切换分辨率不再从宽高反推当前比例（此前为分辨率/长宽比相互影响的机制温床），比例切换器、导出面板、agent 工具全部直读状态；画布设定一经确立（用户/宿主显式设置、恢复持久化、首素材反推任一发生）即锁定，不再被覆盖 (2026-09-20)
* 新增首开画布反推：画布从未确立时，推入首个视频/图片素材自动按素材原始尺寸确立比例与分辨率档位，视频同时按原始帧率确立 fps（mediabunny 纯 demux 探测，对齐 FPS_OPTIONS 最近档位如 29.97→30，探测失败不阻塞推入）；优先级为「恢复持久化 > 宿主/editor props 显式设置 > 首素材反推 > 默认 4:3@1080P/30」(2026-09-20)
* 新增并导出 `inferCanvasFromVideo`（素材尺寸→比例+分辨率档位反推，log 距离度量天然兼容 21:9 降档列与竖屏场景，供宿主复用）、`nearestFpsOption`、`probeVideoFps`、`calcAspectRatio` 工具函数；旧项目持久数据缺 `aspectRatio` 字段时恢复链路自动反推补写完成迁移 (2026-09-20)
* 新增导出 MP3 音频格式：导出面板音频格式下拉恢复 MP3 选项；优先 mediabunny 流式转码（WebCodecs mp3 编码，Chrome 133+），浏览器无 mp3 编码能力（Safari/Firefox）或运行时转码失败时自动回落 ffmpeg.wasm libmp3lame 重编码，非合法码率档位自动就近对齐 (2026-09-21)

### Bug Fixes

* 修复画布容器变大后旧适配上限未清零的问题：`fitBoxSize` 此前仅在缩放比 <1 时写入适配上限，容器放大后残留旧值导致画布不再随之放大（现 else 分支重置） (2026-09-21)
* `canvasScale` 改为上报有效显示缩放（适配比例 × 用户缩放倍数，放得下时按 1:1 计），修复画布小于容器场景下文本编辑浮层按错误比例定位/缩放的偏差 (2026-09-21)
* 修复变速修复音调（repairPitch）兜底链路产物损坏的问题：从 `extractAudioFromVideoByCopy` 返回的 ArrayBuffer 上错误解构 `.buffer` 得到 undefined，生成的音轨 Blob 内容为字符串 "undefined"，变速素材在 remux 提取音轨失败时会走入此链路 (2026-09-21)
* 清理全部 47 个既有 TypeScript 类型错误（`vue-tsc --noEmit` 归零，typecheck 与构建通过）：`defineModel` 的对象/数组/Set default 改工厂函数（消除 library 组件的连锁类型崩溃）、`import.vue` 补 `boolean`/`number` 显式泛型（原推断为字面量 `false`/`0` 导致赋值报错）、正则匹配变量在闭包内取局部常量保持空收窄、`reset()` 明确返回 `Promise<void>`、`globalFFmpegScripts` 补类型注解、catch 错误对象改 `(err as Error)?.message` 等 (2026-09-21)
* 修复本地 dev 启动报「webcut could not be resolved」的问题：examples 以外部宿主视角裸导入 `webcut`/`webcut/webcomponents`/`webcut/react` 及产物 style.css，此前靠 `.vite` 旧缓存侥幸工作，lockfile 变化触发依赖重新预构建后暴露；vite 配置新增 `resolve.alias` 将三个裸导入别名到源码入口（免先构建、支持 HMR），产物 style.css 别名到空占位（dev 下组件样式由 SFC 自动注入） (2026-09-21)
* 修复画布分辨率与长宽比相互影响的问题：旧分辨率档位尺寸表中 12 处错误条目（如 720P 的 9:16 实为 2:3、3:4 实为 9:10，480P/360P 的 21:9 与 16:9 同尺寸、9:16 与 1:1 同尺寸）导致「切换长宽比在特定分辨率下不生效」「切换分辨率后长宽比被静默改写」；8 张手写尺寸表统一改为 `buildAspectRatioSizeMap` 按比例精确生成（偶数取整，所有条目均可反解回自身档位），本来正确的档位数值保持不变 (2026-09-20)
* 修复 undo 点击无效果的问题：串行化历史操作消除与未 await 的 `pushHistory` 之间的竞态；恢复完成后统一补齐动画重算、tickInterceptor 刷新、总时长更新与画面重绘；撤销/重做按钮在恢复期间禁用防止堆积 (2026-08-17)
* 修复撤销后状态与画面不刷新的问题：恢复时同步 source 与新 rails 的关联（跨轨道移动场景），并按新 rails 过滤保留选中状态而非全部清空 (2026-08-17)
* 修复变速素材撤销/重做后时长被二次换算错误的问题（恢复时按文件时长传参） (2026-08-17)
* 修复恢复历史时 autoFit 重算覆盖快照中精确 rect 的问题（恢复场景禁用 autoFit） (2026-08-17)
* 修复 `deleteSegment` 销毁素材后未从 sprites/clips 数组移除引用的问题（现统一走驻留池摘除） (2026-08-17)
* 修复素材切分后偶尔崩坏（预览变灰块、播放无内容）问题：将 `clip.split` 改为只调用一次并复用左右两半、及时销毁未使用片段，导出前先从 canvas 摘除原 sprite 避免并发解码共享 localFile；移除 `onAfterGen` 对新 clip tickInterceptor 的错误覆盖；文本切分透传 css/highlights 防止样式丢失；切分按钮在 loading 期间禁用防止重复触发 (2026-07-04)

### [0.2.1](https://github.com/tangshuang/webcut/compare/v0.2.0...v0.2.1) (2025-12-05)

### [0.1.13](https://github.com/tangshuang/webcut/compare/v0.1.12...v0.1.13) (2025-12-05)


### Features

* 简化Tool的名称 ([85264ca](https://github.com/tangshuang/webcut/commit/85264ca4ed908a0363a5547bce45a380ce6c96fc))
* 为不同素材增加直接在轨道中导出的能力 ([f2ca3da](https://github.com/tangshuang/webcut/commit/f2ca3dafe25991c65c871b04bba09e4a1a11669f))
* 新增右侧面板多语言 ([76321d7](https://github.com/tangshuang/webcut/commit/76321d76eb85e021902ac830696081f5a46dc9ac))
* 新增concat工具，并且修复exportBlobOffscreen导出视频黑屏问题 ([82df7f8](https://github.com/tangshuang/webcut/commit/82df7f8033076dd03454f7c8f550aaa6d9e065c0))
* 优化视频segment的展示，以最快的速度开始呈现 ([4f0e1fa](https://github.com/tangshuang/webcut/commit/4f0e1fa30493997b3adfddafc95838bde0c7469d))
* 支持水平翻转素材 ([3803df0](https://github.com/tangshuang/webcut/commit/3803df04cd82c343537dd69ac53e0f4136700e23))
* 重命名了部分组件，导出新的组件，优化了性能，修复了bug ([ab23c99](https://github.com/tangshuang/webcut/commit/ab23c998bd17ba213bb0fdd66a0ad5b32871958d))


### Bug Fixes

* 修复样式细节 ([a5e0821](https://github.com/tangshuang/webcut/commit/a5e0821e60ff17b70cf92fb4ddaef9e76d496319))
* 修复样式细节 ([1214220](https://github.com/tangshuang/webcut/commit/1214220c5b2379f3510e1397b19d743162d9d896))
* 修复segment拖动切换rail之后，无法再次被选中问题 ([5cc2c01](https://github.com/tangshuang/webcut/commit/5cc2c011af970dee8b5095c299bb123c331f6c60))

### [0.1.12](https://github.com/tangshuang/webcut/compare/v0.1.11...v0.1.12) (2025-12-05)


### Features

* 更新和完善了多语言体系，现在可以支持英文了 ([a47fb25](https://github.com/tangshuang/webcut/commit/a47fb255517c490207a35bc87bc10fcdbb91ccb8))
* 完善多语言支持，目前仅增加英语 ([da392b3](https://github.com/tangshuang/webcut/commit/da392b327a46bbd87d73031dd8d148b6b482e781))
* 新增多个语言 ([3529d5f](https://github.com/tangshuang/webcut/commit/3529d5f12d8828ffc2b73de92b3039a66170755a))

### [0.1.11](https://github.com/tangshuang/webcut/compare/v0.1.10...v0.1.11) (2025-12-04)


### Features

* 优化了轨道中视频的展示，提升了展示性能 ([0e5b523](https://github.com/tangshuang/webcut/commit/0e5b523c570c3f877182a8cc3e326e7c7784ad97))


### Bug Fixes

* 修复刻度缩放器无法到顶的UI问题 ([6d4dc45](https://github.com/tangshuang/webcut/commit/6d4dc453fcffa3472dcede6c1a67f9146d9887d9))

### [0.1.10](https://github.com/tangshuang/webcut/compare/v0.1.9...v0.1.10) (2025-12-04)


### Features

* 优化了darkmode传递细节，优化了library中素材的排序，优化了视频轨道的展示 ([664c493](https://github.com/tangshuang/webcut/commit/664c49309cab13edfcde7fc9692238af9dd45065))
* 只有当merge时才触发发布操作 ([0f76f56](https://github.com/tangshuang/webcut/commit/0f76f56c7f515f15476faa5c7807c98b6c36ae00))


### Bug Fixes

* 修复workflow ([620f8cb](https://github.com/tangshuang/webcut/commit/620f8cb9271f636aaaa847bc89a0621168d11874))

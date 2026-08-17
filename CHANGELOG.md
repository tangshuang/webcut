# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [Unreleased]

### Features

* 重构历史记录（undo/redo）系统：历史操作（push/undo/redo/恢复）全部经每项目串行队列执行，彻底消除并发交错；undo/redo 直接使用目标历史条目的完整快照恢复，不再从运行态反推
* 新增 source 驻留池（`src/hooks/source-park.ts`）：撤销/重做/删除恢复时优先复用已构建的素材（不销毁 clip/sprite），避免反复创建/销毁解码器导致的内存压力与素材恢复失败
* 新增手势事务 API：`useWebCutHistory` 返回 `touch/beginTransaction/commitTransaction/cancelTransaction`，连续调整（滑杆/拖拽/文本输入）静默后合并为一条历史；画布拖拽可通过新导出的 `requestHistoryTouch` 显式打点，不再依赖属性面板的隐式副作用
* 历史存储分表（DB v8）：历史列表行只保留轻量数据，全量快照独立存于 `project_history_snapshot`，旧数据读取时自动迁移，显著降低每次历史操作的 IO 与存储体积
* 历史记录恢复引擎分级应用：位置/时长/变速/滤镜/动画/音量等属性变化一律原地更新 sprite 与 meta，仅素材身份变化（类型/文件/入点/文本内容）才重建

### Bug Fixes

* 修复 undo 点击无效果的问题：串行化历史操作消除与未 await 的 `pushHistory` 之间的竞态；恢复完成后统一补齐动画重算、tickInterceptor 刷新、总时长更新与画面重绘；撤销/重做按钮在恢复期间禁用防止堆积
* 修复撤销后状态与画面不刷新的问题：恢复时同步 source 与新 rails 的关联（跨轨道移动场景），并按新 rails 过滤保留选中状态而非全部清空
* 修复变速素材撤销/重做后时长被二次换算错误的问题（恢复时按文件时长传参）
* 修复恢复历史时 autoFit 重算覆盖快照中精确 rect 的问题（恢复场景禁用 autoFit）
* 修复 `deleteSegment` 销毁素材后未从 sprites/clips 数组移除引用的问题（现统一走驻留池摘除）
* 修复素材切分后偶尔崩坏（预览变灰块、播放无内容）问题：将 `clip.split` 改为只调用一次并复用左右两半、及时销毁未使用片段，导出前先从 canvas 摘除原 sprite 避免并发解码共享 localFile；移除 `onAfterGen` 对新 clip tickInterceptor 的错误覆盖；文本切分透传 css/highlights 防止样式丢失；切分按钮在 loading 期间禁用防止重复触发

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

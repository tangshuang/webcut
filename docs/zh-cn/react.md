# 在 React 中使用 WebCut

WebCut 内部基于 Vue 3 实现，官方通过 [veaury](https://github.com/gloriasoft/veaury) 提供了一层 React 接口，可在 React 应用中直接使用全部组件。

## 安装

```bash
npm install webcut
# React 由宿主提供（peer 依赖）
```

## 快速上手

```tsx
import { WebCutEditor } from 'webcut/react';
// 样式（组件样式 + 内置 UI 库样式）
import 'webcut/react/style.css';

export function EditorPage() {
  return <WebCutEditor projectId="example-project" />;
}
```

`webcut/react` 产物已将 Vue 运行时、naive-ui、veaury 全部打包在内，宿主 React 项目**无需**安装 Vue。

## 桥接约定

| Vue 侧 | React 侧 |
|---|---|
| `v-model:darkMode` | `darkMode` prop + `onUpdateDarkMode` 回调 |
| `v-model:isDarkMode`（Provider） | `isDarkMode` + `onUpdateIsDarkMode` |
| `v-model:language` | `language` + `onUpdateLanguage` |
| 具名插槽（`header` / `footer` / `rightTopBar`） | 同名 ReactNode prop |
| 默认插槽 | `children` |
| 事件 `@xxx` | `onXxx` 回调 |

示例（受控暗色模式 + 插槽）：

```tsx
const [dark, setDark] = useState<boolean | null>(null);

<WebCutEditor
  projectId="example-project"
  darkMode={dark}
  onUpdateDarkMode={setDark}
  header={<div>我的标题</div>}
/>
```

## 可用组件

全部视图组件均已桥接导出：

- **WebCutEditor**（完整编辑器，推荐入口）
- **WebCutProvider** / WebCutLoading / WebCutToast / WebCutThemeBox / WebCutThemeSwitch / WebCutLangSwitch
- 播放器：WebCutPlayer / WebCutPlayerScreen / WebCutPlayerButton / WebCutSelectAspectRatio / WebCutSelectResolution / WebCutTimeClock
- 管理器：WebCutManager 及其子组件、全部工具（WebCutSplitTool 等）
- 素材库：WebCutLibrary 及其子组件
- 面板：WebCutPanel / Basic / Text / Audio / Video / Filter / Animation
- 导出：WebCutExport / WebCutExportButton / WebCutExportPanel / WebCutExportModal
- 纯工具与类型：`aspectRatioMap`、文件/FFmpeg/remux 工具、db 持久化 API、全部 `WebCut*` 类型

## 限制

- Vue 组合式 API hooks（`useWebCutContext` / `useWebCutPlayer` 等）与 `createWebCutAgentPack` 依赖 Vue 组件上下文，**不能**在 React 组件中调用；需要深度定制时请通过组合上述 React 组件实现，或在 Vue 侧封装后再桥接。
- 对 Vue 组件实例的模板 ref 操作（如 `WebCutLibraryAside` 的实例方法）未做桥接封装。
- 如需自定义桥接（如更多插槽/事件映射），可直接使用 `veaury` 的 `applyVueInReact` 包裹 `webcut` 包内导出的任意 Vue 组件。

## 本地开发调试

仓库根目录已内置 React 示例工程：

```bash
cd examples/react
yarn install
yarn dev
```

# 钩子（Hooks）

用于控制画布、时间线、素材与历史的组合式 API。

## 组件钩子

### useScrollBox

ScrollBox 组件的钩子，管理滚动行为（见 `src/components/scroll-box`）。

- 处理滚动事件，实现自定义滚动条和滚动逻辑。
- 提供滚动同步和位置控制功能。

## 核心钩子

### useWebCutContext

提供项目上下文与选中状态（见 `src/hooks/index.ts`）。

- 字段包括 `width`、`height`、`canvas`、`clips`、`sprites`、`sources`、`cursorTime`、`status`、`fps`、`scale`、`rails`、`selected`、`current`（见 `src/types/index.ts`）
- 独立使用钩子时，在顶层调用 `provide()` 提供上下文

#### 使用示例

```typescript
import { useWebCutContext } from 'webcut'

// 在根组件中提供上下文
const { provide } = useWebCutContext({
  width: 1920,
  height: 1080,
  fps: 30
})

provide()

// 在子组件中使用上下文
const { width, height, canvas, sprites, selected } = useWebCutContext()
```

### useWebCutPlayer

核心媒体操作（见 `src/hooks/index.ts`）。

- 播放控制：`init`、`play`、`pause`、`reset`、`moveTo`
- 推入素材：`push(type, source, meta)`，`WebCutMaterialMeta` 定义见 `src/types/index.ts`
- 清理与销毁：`remove(key)`、`clear()`、`destroy()`
- 导出：`exportBlob()`、`exportAsWavBlob()`、`download(filename)`
- 文本更新：`updateText(key, data)` 重新渲染文本为位图
- 其他：`captureImage()`、`resize()`

#### 使用示例

```typescript
import { useWebCutPlayer } from 'webcut'

const player = useWebCutPlayer()

// 初始化播放器
await player.init()

// 添加视频素材
await player.push('video', 'https://example.com/video.mp4', {
  autoFitRect: 'contain',
  time: { start: 0, duration: 5000000 } // 5秒，以纳秒为单位
})

// 添加文本素材
await player.push('text', 'Hello World', {
  text: {
    css: 'font-size: 48px; color: white;',
    highlights: []
  },
  rect: { x: 100, y: 100, w: 400, h: 100 }
})

// 播放控制
player.play()
player.pause()
player.moveTo(1000000) // 移动到1秒位置

// 导出
const blob = await player.exportBlob()
player.download('my-video')
```

### useWebCutData

管理编辑器数据的加载、保存和更新（见 `src/hooks/index.ts`）。

- 提供数据管理功能，支持项目数据的持久化和恢复。

#### 使用示例

```typescript
import { useWebCutData } from 'webcut'

const { saveProject, loadProject, updateProject } = useWebCutData()

// 保存项目
await saveProject()

// 加载项目
await loadProject('project-id')

// 更新项目
await updateProject({ name: 'My Project' })
```

### useWebCutThemeColors

管理主题颜色（见 `src/hooks/index.ts`）。

- 提供主题颜色的获取和管理功能，支持自定义主题。

#### 使用示例

```typescript
import { useWebCutThemeColors } from 'webcut'

const { colors, setTheme, resetTheme } = useWebCutThemeColors()

// 设置自定义主题
setTheme({
  primary: '#ff6b6b',
  secondary: '#4ecdc4',
  background: '#2d3436',
  surface: '#636e72'
})

// 重置为默认主题
resetTheme()
```

### useWebCutDarkMode

管理暗色模式状态（见 `src/hooks/index.ts`）。

- 处理暗色模式的切换和状态管理。

#### 使用示例

```typescript
import { useWebCutDarkMode } from 'webcut'

const { isDark, toggleDark } = useWebCutDarkMode()

// 切换暗色模式
toggleDark()

// 检查当前模式
if (isDark.value) {
  console.log('当前为暗色模式')
}
```

## 管理器钩子

### useWebCutManager

时间线工具（见 `src/hooks/manager.ts`）。

- 光标：`moveCursorToTime`、`moveCursorToFrame`、`moveCursorToPx`
- 转换：`timeToPx`、`pxToTime`、`pxOf1Frame`、`timeOf1Frame`
- 片段：`resetSegmentTime`、`splitSegment`、`deleteSegment`
- 轨：`toggleRailHidden`、`toggleRailMute`、`resizeManagerMaxHeight`

#### 使用示例

```typescript
import { useWebCutManager } from 'webcut'

const {
  moveCursorToTime,
  splitSegment,
  deleteSegment,
  toggleRailMute,
  timeToPx,
  pxToTime
} = useWebCutManager()

// 移动光标到特定时间
moveCursorToTime(2000000) // 2秒

// 分割当前选中的片段
if (currentSegment.value) {
  splitSegment({
    segment: currentSegment.value,
    rail: currentRail.value,
    keep: 'left' // 保留左侧部分
  })
}

// 静音轨道
if (currentRail.value) {
  toggleRailMute(currentRail.value)
}

// 时间和像素转换
const pixels = timeToPx(1000000) // 1秒对应的像素
const time = pxToTime(100) // 100像素对应的时间
```

## 素材库钩子

### useWebCutLibrary

项目文件管理（见 `src/hooks/library.ts`）。

- `projectFiles`、`files` 列表
- `addNewFile(file)`、`removeFile(fileId)`

#### 使用示例

```typescript
import { useWebCutLibrary } from 'webcut'

const { projectFiles, files, addNewFile, removeFile } = useWebCutLibrary()

// 添加新文件
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.onchange = async (e) => {
  const file = e.target.files[0]
  if (file) {
    await addNewFile(file)
  }
}
fileInput.click()

// 删除文件
await removeFile('file-id')

// 获取项目文件列表
console.log(projectFiles.value)
```

## 本地文件钩子

### useWebCutLocalFile

解析本地文件 URL（见 `src/hooks/local-file.ts`）。

- `applyFileUrl(fileId)`、`fileUrl(fileId)`、`readFile(fileId)`

#### 使用示例

```typescript
import { useWebCutLocalFile } from 'webcut'

const { fileUrl, readFile, applyFileUrl } = useWebCutLocalFile()

// 获取文件URL
const url = fileUrl('file-id')

// 读取文件内容
const file = await readFile('file-id')

// 应用文件URL到元素
applyFileUrl('file-id').then(url => {
  videoElement.src = url
})
```

## 历史钩子

### useWebCutHistory

通过 `HistoryMachine` 持久化并恢复（见 `src/hooks/history.ts`）。

- `pushHistory(state)`、`undo()`、`redo()`、`clearHistory()`
- `canUndo`、`canRedo`、`canRecover`、`recoverProjectState()`

#### 使用示例

```typescript
import { useWebCutHistory } from 'webcut'

const {
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  recoverProjectState
} = useWebCutHistory()

// 保存当前状态到历史
pushHistory({
  type: 'custom-action',
  data: { /* 状态数据 */ }
})

// 撤销操作
if (canUndo.value) {
  undo()
}

// 重做操作
if (canRedo.value) {
  redo()
}

// 清空历史
clearHistory()
```

## 国际化钩子

### useWebCutLocale

国际化语言管理（见 `src/i18n/hooks`）。

- 提供语言切换和本地化支持。

#### 使用示例

```typescript
import { useWebCutLocale } from 'webcut'

export default defineComponent({
  setup() {
    const {
      locale,
      availableLocales,
      t,
      setLocale,
      loadLocale,
      addLocale
    } = useWebCutLocale({
      defaultLocale: 'zh-cn',
      fallbackLocale: 'en'
    })

    // 切换语言
    const switchLanguage = async (lang: string) => {
      try {
        await setLocale(lang)
        console.log(`语言已切换到 ${lang}`)
      } catch (error) {
        console.error('切换语言失败:', error)
      }
    }

    // 添加自定义语言
    const addCustomLocale = (lang: string, messages: Record<string, string>) => {
      addLocale(lang, messages)
    }

    // 带插值的翻译
    const translateWithVars = (key: string, variables: Record<string, any>) => {
      return t(key, variables)
    }

    return {
      locale,
      availableLocales,
      t,
      switchLanguage,
      addCustomLocale,
      translateWithVars
    }
  }
})
```

### useWebCutTranslate

翻译函数钩子（见 `src/i18n/hooks`）。

- 提供简化的翻译函数接口
- 支持键值对翻译和插值
- 自动处理语言切换

#### 使用示例

```typescript
import { useWebCutTranslate } from 'webcut'

export default defineComponent({
  setup() {
    const { t } = useWebCutTranslate()

    // 基本翻译
    const title = computed(() => t('common.title'))
    const description = computed(() => t('common.description'))

    // 带参数的翻译
    const welcomeMessage = computed(() =>
      t('welcome.user', { name: '张三', count: 5 })
    )

    // 复数形式
    const itemCount = computed(() =>
      t('items.count', { count: items.value.length })
    )

    // 日期时间翻译
    const formatDate = (date: Date) => {
      return t('date.format', {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString()
      })
    }

    // 错误消息翻译
    const getErrorMessage = (errorCode: string) => {
      return t(`errors.${errorCode}`, {
        defaultValue: '未知错误'
      })
    }

    return {
      title,
      description,
      welcomeMessage,
      itemCount,
      formatDate,
      getErrorMessage
    }
  }
})
```

#### 高级用法

```typescript
import { useWebCutTranslate } from 'webcut'

export default defineComponent({
  setup() {
    const { t, locale, setLocale } = useWebCutTranslate({
      namespace: 'editor', // 指定命名空间
      fallback: 'en' // 设置回退语言
    })

    // 命名空间翻译
    const editorTitle = computed(() => t('title')) // 等同于 'editor.title'

    // 全局翻译
    const globalMessage = computed(() => t('global:message')) // 使用冒号指定全局键

    // 动态键名
    const getDynamicTranslation = (key: string, params?: any) => {
      return t(key, params)
    }

    // 批量翻译
    const translateBatch = (keys: string[]) => {
      return keys.map(key => ({ key, value: t(key) }))
    }

    // 翻译验证
    const validateTranslation = (key: string) => {
      const translated = t(key)
      return translated !== key // 如果翻译后与原键相同，说明缺少翻译
    }

    return {
      t,
      locale,
      setLocale,
      editorTitle,
      globalMessage,
      getDynamicTranslation,
      translateBatch,
      validateTranslation
    }
  }
})
```

## 过渡钩子

### useWebCutTransition

过渡效果钩子（见 `src/hooks/transition.ts`）。

- 提供过渡效果的管理和应用功能。

#### 使用示例

```typescript
import { useWebCutTransition } from 'webcut'

const { applyTransition, getAvailableTransitions } = useWebCutTransition()

// 获取可用的过渡效果
const transitions = getAvailableTransitions()

// 应用过渡效果
await applyTransition('fade-in', {
  duration: 1000000, // 1秒
  easing: 'ease-in-out'
})
```

## 提示钩子

### useWebCutToast

消息提示钩子（见 `src/hooks/toast.ts`）。

- 提供消息提示的显示和管理功能。

#### 使用示例

```typescript
import { useWebCutToast } from 'webcut'

const { showToast, hideToast } = useWebCutToast()

// 显示成功提示
showToast({
  message: '操作成功！',
  type: 'success',
  duration: 3000
})

// 显示错误提示
showToast({
  message: '操作失败，请重试',
  type: 'error',
  duration: 5000
})

// 隐藏提示
hideToast()
```

## 类型

`src/types/index.ts` 中的关键类型：

- `WebCutContext` — 编辑器状态
- `WebCutRail`、`WebCutSegment` — 时间线数据
- `WebCutMaterialMeta` — 推入素材选项
- `WebCutSource`、`WebCutSourceData` — 素材映射与持久化
- `WebCutHighlightOfText` — 文本高亮类型
- `WebCutSegmentOfText` — 文本片段类型
- `WebCutRailOfText` — 文本轨道类型
- `WebCutMaterialType` — 素材类型
- `WebCutMaterial` — 素材类型
- `WebCutProjectHistoryState` — 项目历史状态
- `WebCutProjectHistoryData` — 项目历史数据
- `WebCutColors` — 颜色类型
- `WebCutAnimationType` — 动画类型
- `WebCutAnimationKeyframe` — 动画关键帧类型
- `WebCutAnimationKeyframeConfig` — 动画关键帧配置类型
- `WebCutAnimationParams` — 动画参数类型
- `WebCutAnimationData` — 动画数据类型
- `WebCutTransitionData` — 过渡数据类型
- `WebCutFilterData` — 滤镜数据类型
- `WebCutExtensionPack` — 扩展包类型
- `ToastType` — 消息提示类型
- `ToastOptions` — 消息提示选项类型
- `ToastState` — 消息提示状态类型
- `WebCutExportAudioParams` — 音频导出参数类型
- `WebCutExportVideoParams` — 视频导出参数类型
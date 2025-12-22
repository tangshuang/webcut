# Hooks

Composable APIs to control canvas, timeline, assets, and history.

## Component Hooks

### useScrollBox

ScrollBox component hook for managing scroll behavior (see `src/components/scroll-box`).

- Manages scroll events and custom scrollbar logic.

#### Usage Example

```typescript
import { useScrollBox } from 'webcut'

export default defineComponent({
  setup() {
    const {
      scrollContainer,
      scrollContent,
      scrollPosition,
      scrollTo,
      scrollBy,
      isScrolling
    } = useScrollBox({
      direction: 'vertical',
      scrollbar: true,
      onScroll: (position) => {
        console.log('Scroll position:', position)
      }
    })

    return {
      scrollContainer,
      scrollContent,
      scrollPosition,
      scrollTo,
      scrollBy,
      isScrolling
    }
  }
})
```

## Core Hooks

### useWebCutContext

Provides the reactive project context and selection state (see `src/hooks/index.ts`).

- Fields include `width`, `height`, `canvas`, `clips`, `sprites`, `sources`, `cursorTime`, `status`, `fps`, `scale`, `rails`, `selected`, `current` (see `src/types/index.ts`).
- Call `provide()` once at top-level when using hooks standalone.

#### Usage Example

```typescript
import { useWebCutContext } from 'webcut'

export default defineComponent({
  setup() {
    // Provide context at app root
    const context = useWebCutContext()

    // Access context properties
    const {
      width,
      height,
      canvas,
      clips,
      sprites,
      sources,
      cursorTime,
      status,
      fps,
      scale,
      rails,
      selected,
      current
    } = context

    // Use context methods
    const updateDimensions = (w: number, h: number) => {
      width.value = w
      height.value = h
    }

    const selectClip = (clipId: string) => {
      selected.value = clips.value.find(c => c.id === clipId)
    }

    return {
      width,
      height,
      canvas,
      clips,
      sprites,
      sources,
      cursorTime,
      status,
      fps,
      scale,
      rails,
      selected,
      current,
      updateDimensions,
      selectClip
    }
  }
})
```

### useWebCutPlayer

Core media operations (see `src/hooks/index.ts`).

- `init`, `play`, `pause`, `reset`, `moveTo` — player control
- `push(type, source, meta)` — add media/text with `WebCutMaterialMeta` (see `src/types/index.ts`)
- `remove(key)`, `clear()`, `destroy()` — teardown
- `exportBlob()`, `exportAsWavBlob()` — export MP4/WAV
- `updateText(key, data)` — re-render text as bitmap
- `download(filename)`, `captureImage()`, `resize()`

#### Usage Example

```typescript
import { useWebCutPlayer } from 'webcut'

export default defineComponent({
  setup() {
    const {
      isPlaying,
      currentTime,
      duration,
      volume,
      init,
      play,
      pause,
      reset,
      moveTo,
      push,
      remove,
      clear,
      exportBlob,
      updateText
    } = useWebCutPlayer()

    // Initialize player
    onMounted(() => {
      init({
        width: 1920,
        height: 1080,
        fps: 30,
        backgroundColor: '#000000'
      })
    })

    // Add media to timeline
    const addVideo = async (file: File) => {
      const source = URL.createObjectURL(file)
      await push('video', source, {
        name: file.name,
        duration: 10,
        startTime: 0
      })
    }

    // Add text overlay
    const addText = (text: string) => {
      push('text', text, {
        fontSize: 24,
        color: '#ffffff',
        x: 100,
        y: 100,
        duration: 5
      })
    }

    // Export functionality
    const exportVideo = async () => {
      const blob = await exportBlob({
        format: 'mp4',
        quality: 'high'
      })
      // Download or upload the blob
    }

    return {
      isPlaying,
      currentTime,
      duration,
      volume,
      play,
      pause,
      reset,
      moveTo,
      addVideo,
      addText,
      exportVideo
    }
  }
})
```

### useWebCutData

Manages editor data loading, saving, and updates (see `src/hooks/index.ts`).

- Provides data management functionality for project persistence and recovery.

#### Usage Example

```typescript
import { useWebCutData } from 'webcut'

export default defineComponent({
  setup() {
    const {
      projectData,
      isLoading,
      error,
      loadProject,
      saveProject,
      updateProject,
      exportProject,
      importProject
    } = useWebCutData()

    // Load project on mount
    onMounted(async () => {
      try {
        await loadProject('project-id')
      } catch (err) {
        console.error('Failed to load project:', err)
      }
    })

    // Auto-save functionality
    const autoSave = async () => {
      try {
        await saveProject()
        console.log('Project saved successfully')
      } catch (err) {
        console.error('Failed to save project:', err)
      }
    }

    // Export project
    const handleExport = async () => {
      const projectJson = await exportProject()
      const blob = new Blob([projectJson], { type: 'application/json' })
      // Download the blob
    }

    return {
      projectData,
      isLoading,
      error,
      autoSave,
      handleExport
    }
  }
})
```

### useWebCutThemeColors

Manages theme colors (see `src/hooks/index.ts`).

- Provides theme color management and custom theme support.

#### Usage Example

```typescript
import { useWebCutThemeColors } from 'webcut'

export default defineComponent({
  setup() {
    const {
      colors,
      isDark,
      setTheme,
      updateColors,
      resetColors
    } = useWebCutThemeColors()

    // Apply custom theme
    const applyCustomTheme = () => {
      updateColors({
        primary: '#007bff',
        secondary: '#6c757d',
        background: '#ffffff',
        text: '#333333',
        border: '#dee2e6'
      })
    }

    // Toggle dark mode
    const toggleDarkMode = () => {
      setTheme(isDark.value ? 'light' : 'dark')
    }

    return {
      colors,
      isDark,
      applyCustomTheme,
      toggleDarkMode
    }
  }
})
```

### useWebCutDarkMode

Manages dark mode state (see `src/hooks/index.ts`).

- Handles dark mode switching and state management.

#### Usage Example

```typescript
import { useWebCutDarkMode } from 'webcut'

export default defineComponent({
  setup() {
    const {
      isDark,
      toggle,
      enable,
      disable,
      systemPreference
    } = useWebCutDarkMode({
      defaultMode: 'auto',
      localStorageKey: 'webcut-theme'
    })

    // Watch for system preference changes
    watch(systemPreference, (pref) => {
      console.log('System theme preference:', pref)
    })

    return {
      isDark,
      toggle,
      enable,
      disable
    }
  }
})
```

## Manager Hooks

### useWebCutManager

Timeline utilities (see `src/hooks/manager.ts`).

- Cursor: `moveCursorToTime`, `moveCursorToFrame`, `moveCursorToPx`
- Conversions: `timeToPx`, `pxToTime`, `pxOf1Frame`, `timeOf1Frame`
- Segment ops: `resetSegmentTime`, `splitSegment`, `deleteSegment`
- Rails: `toggleRailHidden`, `toggleRailMute`, `resizeManagerMaxHeight`

#### Usage Example

```typescript
import { useWebCutManager } from 'webcut'

export default defineComponent({
  setup() {
    const {
      cursorTime,
      scale,
      rails,
      segments,
      moveCursorToTime,
      moveCursorToFrame,
      moveCursorToPx,
      timeToPx,
      pxToTime,
      splitSegment,
      deleteSegment,
      toggleRailHidden,
      toggleRailMute
    } = useWebCutManager()

    // Handle timeline click
    const handleTimelineClick = (event: MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const px = event.clientX - rect.left
      moveCursorToPx(px)
    }

    // Split segment at cursor
    const splitAtCursor = () => {
      const currentSegment = getCurrentSegment()
      if (currentSegment) {
        splitSegment(currentSegment.id, cursorTime.value)
      }
    }

    // Zoom timeline
    const handleZoom = (delta: number) => {
      scale.value = Math.max(0.1, Math.min(10, scale.value + delta))
    }

    return {
      cursorTime,
      scale,
      rails,
      segments,
      handleTimelineClick,
      splitAtCursor,
      handleZoom
    }
  }
})
```

## Library Hooks

### useWebCutLibrary

Project files from OPFS-backed storage (see `src/hooks/library.ts`).

- `projectFiles`, `files` — computed lists
- `addNewFile(file)`, `removeFile(fileId)`

#### Usage Example

```typescript
import { useWebCutLibrary } from 'webcut'

export default defineComponent({
  setup() {
    const {
      projectFiles,
      files,
      isLoading,
      addNewFile,
      removeFile,
      getFileById,
      searchFiles
    } = useWebCutLibrary()

    // Handle file upload
    const handleFileUpload = async (event: Event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        try {
          await addNewFile(file)
          console.log('File added successfully')
        } catch (error) {
          console.error('Failed to add file:', error)
        }
      }
    }

    // Search functionality
    const searchQuery = ref('')
    const filteredFiles = computed(() => {
      return searchFiles(searchQuery.value)
    })

    // File management
    const deleteFile = async (fileId: string) => {
      if (confirm('Are you sure you want to delete this file?')) {
        await removeFile(fileId)
      }
    }

    return {
      projectFiles,
      files,
      isLoading,
      searchQuery,
      filteredFiles,
      handleFileUpload,
      deleteFile
    }
  }
})
```

## Local File Hooks

### useWebCutLocalFile

Resolve blob URLs for locally stored files (see `src/hooks/local-file.ts`).

- `applyFileUrl(fileId)`, `fileUrl(fileId)`, `readFile(fileId)`

#### Usage Example

```typescript
import { useWebCutLocalFile } from 'webcut'

export default defineComponent({
  setup() {
    const {
      fileUrls,
      isLoading,
      applyFileUrl,
      fileUrl,
      readFile,
      clearCache
    } = useWebCutLocalFile()

    // Load file URL
    const loadFileUrl = async (fileId: string) => {
      try {
        const url = await applyFileUrl(fileId)
        return url
      } catch (error) {
        console.error('Failed to load file URL:', error)
        return null
      }
    }

    // Read file content
    const getFileContent = async (fileId: string) => {
      try {
        const content = await readFile(fileId)
        return content
      } catch (error) {
        console.error('Failed to read file:', error)
        return null
      }
    }

    // Preload multiple files
    const preloadFiles = async (fileIds: string[]) => {
      for (const id of fileIds) {
        await loadFileUrl(id)
      }
    }

    return {
      fileUrls,
      isLoading,
      loadFileUrl,
      getFileContent,
      preloadFiles
    }
  }
})
```

## History Hooks

### useWebCutHistory

Persist and restore via `HistoryMachine` (see `src/hooks/history.ts`).

- `pushHistory(state)`, `undo()`, `redo()`, `clearHistory()`
- `canUndo`, `canRedo`, `canRecover`, `recoverProjectState()`

#### Usage Example

```typescript
import { useWebCutHistory } from 'webcut'

export default defineComponent({
  setup() {
    const {
      history,
      currentIndex,
      canUndo,
      canRedo,
      canRecover,
      pushHistory,
      undo,
      redo,
      clearHistory,
      recoverProjectState
    } = useWebCutHistory({
      maxHistorySize: 50,
      autoSave: true
    })

    // Save state to history
    const saveState = (state: any) => {
      pushHistory({
        ...state,
        timestamp: Date.now(),
        description: 'Manual save'
      })
    }

    // Keyboard shortcuts
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault()
          undo()
        } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
          event.preventDefault()
          redo()
        }
      }
    }

    // Auto-save on changes
    const autoSave = debounce((state: any) => {
      saveState(state)
    }, 1000)

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    return {
      history,
      currentIndex,
      canUndo,
      canRedo,
      saveState,
      undo,
      redo,
      clearHistory
    }
  }
})
```

## Internationalization Hooks

### useWebCutLocale

Internationalization language management (see `src/i18n/hooks`).

- Provides language switching and localization support.

#### Usage Example

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
      defaultLocale: 'en',
      fallbackLocale: 'en'
    })

    // Switch language
    const switchLanguage = async (lang: string) => {
      try {
        await setLocale(lang)
        console.log(`Language switched to ${lang}`)
      } catch (error) {
        console.error('Failed to switch language:', error)
      }
    }

    // Add custom locale
    const addCustomLocale = (lang: string, messages: Record<string, string>) => {
      addLocale(lang, messages)
    }

    // Translate with interpolation
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

Translation function hook (see `src/i18n/hooks`).

- Provides simplified translation function interface
- Supports key-value translation and interpolation
- Automatically handles language switching

#### Usage Example

```typescript
import { useWebCutTranslate } from 'webcut'

export default defineComponent({
  setup() {
    const { t } = useWebCutTranslate()

    // Basic translation
    const title = computed(() => t('common.title'))
    const description = computed(() => t('common.description'))

    // Translation with parameters
    const welcomeMessage = computed(() =>
      t('welcome.user', { name: 'John', count: 5 })
    )

    // Plural forms
    const itemCount = computed(() =>
      t('items.count', { count: items.value.length })
    )

    // Date/time translation
    const formatDate = (date: Date) => {
      return t('date.format', {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString()
      })
    }

    // Error message translation
    const getErrorMessage = (errorCode: string) => {
      return t(`errors.${errorCode}`, {
        defaultValue: 'Unknown error'
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

#### Advanced Usage

```typescript
import { useWebCutTranslate } from 'webcut'

export default defineComponent({
  setup() {
    const { t, locale, setLocale } = useWebCutTranslate({
      namespace: 'editor', // Specify namespace
      fallback: 'en' // Set fallback language
    })

    // Namespace translation
    const editorTitle = computed(() => t('title')) // Equivalent to 'editor.title'

    // Global translation
    const globalMessage = computed(() => t('global:message')) // Use colon for global key

    // Dynamic key name
    const getDynamicTranslation = (key: string, params?: any) => {
      return t(key, params)
    }

    // Batch translation
    const translateBatch = (keys: string[]) => {
      return keys.map(key => ({ key, value: t(key) }))
    }

    // Translation validation
    const validateTranslation = (key: string) => {
      const translated = t(key)
      return translated !== key // If translated is same as key, translation is missing
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

## Transition Hooks

### useWebCutTransition

Transition effect management for UI animations (see `src/hooks/transition.ts`).

- `show`, `hide`, `toggle` — transition control
- `isVisible`, `isAnimating` — transition state
- `setConfig` — configuration management

#### Usage Example

```typescript
import { useWebCutTransition } from 'webcut'

export default defineComponent({
  setup() {
    const {
      isVisible,
      isAnimating,
      show,
      hide,
      toggle,
      setConfig
    } = useWebCutTransition({
      duration: 300,
      easing: 'ease-in-out',
      type: 'fade'
    })

    // Custom transition configuration
    const updateTransition = (type: string) => {
      setConfig({
        type,
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      })
    }

    // Handle transition events
    watch(isVisible, (visible) => {
      console.log('Transition visibility changed:', visible)
    })

    watch(isAnimating, (animating) => {
      console.log('Transition animating:', animating)
    })

    return {
      isVisible,
      isAnimating,
      show,
      hide,
      toggle,
      updateTransition
    }
  }
})
```

## Toast Hooks

### useWebCutToast

Toast notification management (see `src/hooks/toast.ts`).

- `showToast`, `hideToast`, `clearToasts` — toast control
- `toasts` — reactive toast list

#### Usage Example

```typescript
import { useWebCutToast } from 'webcut'

export default defineComponent({
  setup() {
    const {
      toasts,
      showToast,
      hideToast,
      clearToasts
    } = useWebCutToast({
      position: 'top-right',
      duration: 5000,
      maxToasts: 3
    })

    // Show different types of toasts
    const showSuccess = (message: string) => {
      showToast(message, 'success')
    }

    const showError = (message: string) => {
      showToast(message, 'error')
    }

    const showWarning = (message: string) => {
      showToast(message, 'warning')
    }

    const showInfo = (message: string) => {
      showToast(message, 'info')
    }

    // Show toast with action
    const showWithAction = (message: string, action: () => void) => {
      const id = showToast(message, 'info', {
        duration: 0, // Don't auto-hide
        action: {
          label: 'Undo',
          handler: action
        }
      })
      return id
    }

    return {
      toasts,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showWithAction,
      hideToast,
      clearToasts
    }
  }
})
```

## Types

Key types in `src/types/index.ts`:

- `WebCutContext` — editor state
- `WebCutRail`, `WebCutSegment` — timeline data
- `WebCutMaterialMeta` — push options
- `WebCutSource`, `WebCutSourceData` — source mapping and persistence
- `WebCutHighlightOfText` — text highlight type
- `WebCutSegmentOfText` — text segment type
- `WebCutRailOfText` — text rail type
- `WebCutMaterialType` — material type
- `WebCutMaterial` — material type
- `WebCutProjectHistoryState` — project history state
- `WebCutProjectHistoryData` — project history data
- `WebCutColors` — color type
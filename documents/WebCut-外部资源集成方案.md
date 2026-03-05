# WebCut 外部资源集成需求实现文档

> **重要更新说明**：本文档已针对以下两个关键问题进行了更新：
> 1. **媒体库展示问题**：`push()` 只会添加到 Canvas 和时间轴，需要额外调用 API 才能在媒体库中显示
> 2. **数据污染问题**：每次跳转需要创建全新的项目 ID，避免继承上一次的编辑状态

## 需求概述

本需求文档描述如何将外部网站的资源（媒体文件和timeline配置）通过 URL 跳转 + sessionStorage 的方式传递到 WebCut 编辑器中，实现外部资源与 WebCut 的无缝集成。

### 核心需求

1. **URL 跳转传参**：从外部网站跳转到 WebCut 编辑器页面
2. **sessionStorage 数据传递**：通过 sessionStorage 携带资源引用信息（ID/引用）
3. **媒体资源加载**：从外部读取文件数据（缓冲/Base64），作为媒体库内容展示
4. **Timeline 初始化**：将时间线信息（轨道、片段）作为初始状态加载到编辑器

### 使用场景

外部网站已有视频/图片/音频素材库，希望：
- 用户选中某些素材后，点击"编辑"按钮
- 跳转到 WebCut 编辑器页面，并自动加载选中的素材
- 同时带入用户在外部网站已经编辑好的时间线配置

---

## 技术架构分析

### WebCut 核心 API

#### 1. useWebCutPlayer - 素材推送

```typescript
const { push, pushSeries } = useWebCutPlayer();

/**
 * 将素材推送到视频中
 * @param type - 素材类型: 'video' | 'audio' | 'image' | 'text'
 * @param source - 素材源: File | base64 data URL | file:{fileId} | URL
 * @param meta - 元数据配置
 */
async function push(
  type: WebCutMaterialType, 
  source: string | File, 
  meta?: WebCutSourceMeta
): Promise<string>  // 返回 sourceKey
```

**source 参数支持格式**：
- `File` 对象 - 本地文件
- `data:video/xxx;base64,...` - Base64 编码
- `file:{fileId}` - OPFS 存储的文件（WebCut 内部存储）
- `https://...` - 远程 URL

**meta 参数结构**：
```typescript
interface WebCutSourceMeta {
  // 位置与尺寸
  rect?: { x?: number; y?: number; w?: number; h?: number; angle?: number };
  zIndex?: number;
  opacity?: number;
  flip?: { horizontal?: boolean; vertical?: boolean };
  visible?: boolean;
  
  // 时间信息
  time?: {
    start?: number;      // 开始时间（纳秒）
    duration?: number;   // 持续时间（纳秒）
    playbackRate?: number; // 播放速率
  };
  
  // 音频/视频特定
  audio?: { volume?: number; offset?: number; loop?: boolean };
  video?: { volume?: number; offset?: number };
  
  // 文本特定
  text?: { css?: object; highlights?: WebCutHighlightOfText[] };
  
  // 滤镜与动画
  filters?: WebCutFilterData[];
  animation?: WebCutAnimationData;
  
  // 轨道控制
  withRailId?: string;     // 指定添加到哪个轨道
  withSegmentId?: string;  // 指定 segment ID
  thingType?: string;      // 资源类型
}
```

#### 2. useWebCutContext - 状态管理

```typescript
const context = useWebCutContext();
// 核心状态
context.rails        // 轨道列表 WebCutRail[]
context.sources      // 素材映射 Map<string, WebCutSource>
context.cursorTime  // 当前播放位置（纳秒）
context.duration     // 总时长（纳秒）
```

#### 3. 数据库操作

```typescript
import { readFile, writeFile, getFile } from 'webcut';

// 从 OPFS 读取文件
async function readFile(fileId: string): Promise<File | null>

// 写入文件到 OPFS（返回 fileId）
async function writeFile(f: File): Promise<string>

// 获取文件元数据
async function getFile(fileId: string): Promise<WebCutMaterial>
```

### 数据结构

---

## 关键问题解析

### 问题 1：push() 后的数据流分析

**重要理解**：调用 `push()` 方法后，数据的展示路径如下：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         push() 方法                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   Canvas     │     │   Manager    │     │   Library    │       │
│   │  (画布渲染)   │     │  (时间轴)    │     │   (媒体库)   │       │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘       │
│          │                    │                    │                │
│          ▼                    ▼                    ▼                │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   sprites   │     │ rails[]      │     │ project.files│       │
│   │  ✅ 自动     │     │ segments[]   │     │ ❌ 需手动    │       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                     │
│   push() 会自动      push() 会自动          需要调用               │
│   更新              更新                  addFileToProject()        │
└─────────────────────────────────────────────────────────────────────┘
```

**结论**：
- **时间轴 (Manager)**：✅ `push()` 会自动创建 `segment` 并添加到 `rails`，会自动显示
- **画布 (Canvas)**：✅ `push()` 会自动添加 `sprite` 到 Canvas，会自动渲染
- **媒体库 (Library)**：❌ `push()` 不会自动添加到项目文件列表，需要手动调用

---

### 问题 1.5：媒体库自动导入 + 去重

**核心问题**：外部资源的 ID（如 "file-001"）与 WebCut 内部的文件 ID（MD5 hash）不一致，如何正确导入并去重？

**解决方案**：利用 WebCut 的去重机制

```
外部资源导入流程：

1. loadFile(id)          → 获取 File/Blob
         │
         ▼
2. writeFile(File)       → 写入 OPFS，返回 MD5-based fileId
         │
         ▼
3. push('video', file:{fileId})  → 添加到时间轴+画布
         │
         ▼
4. addFileToProject(projectId, fileId)  → 添加到媒体库
         │
         ▼
5. 去重检查：project.files 中已存在相同 fileId 则跳过
```

**关键 API**：

```typescript
import { writeFile, addFileToProject } from 'webcut';

// 步骤 1：写入 OPFS，返回 MD5-based fileId（自动去重）
const fileId = await writeFile(fileObject);

// 步骤 2：添加到项目（如果已存在则自动跳过）
await addFileToProject(projectId, fileId);

// 内部会检查：
// if (project.files.some(f => f.id === fileId)) return;  // 已存在，跳过
```

**完整导入函数**（已更新到上面的代码）：

```typescript
async function importWithOptions(resources, options) {
  const { loadFile, addToLibrary } = options;
  
  for (const resource of resources) {
    // 1. 获取文件
    const fileData = await loadFile(resource.id);
    const file = new File([fileData], resource.name, { type: fileData.type });
    
    // 2. 写入 OPFS（返回 MD5-based fileId，自动去重）
    const fileId = await writeFile(file);
    
    // 3. 添加到时间轴（使用 file:{fileId} 格式）
    const sourceKey = await push(resource.type, `file:${fileId}`);
    
    // 4. 添加到媒体库（自动检查去重）
    if (addToLibrary) {
      await addFileToProject(projectId, fileId);  // 内部已做好去重
    }
  }
}
```
┌─────────────────────────────────────────────────────────────────────┐
│                         push() 方法                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   Canvas     │     │   Manager    │     │   Library    │       │
│   │  (画布渲染)   │     │  (时间轴)    │     │   (媒体库)   │       │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘       │
│          │                    │                    │                │
│          ▼                    ▼                    ▼                │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   sprites   │     │ rails[]      │     │ project.files│       │
│   │  ✅ 自动     │     │ segments[]   │     │ ❌ 需手动    │       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                     │
│   push() 会自动      push() 会自动          需要调用               │
│   更新              更新                  addFileToProject()        │
└─────────────────────────────────────────────────────────────────────┘
```

**结论**：
- **时间轴 (Manager)**：✅ `push()` 会自动创建 `segment` 并添加到 `rails`，会自动显示
- **画布 (Canvas)**：✅ `push()` 会自动添加 `sprite` 到 Canvas，会自动渲染
- **媒体库 (Library)**：❌ `push()` 不会自动添加到项目文件列表，需要手动调用

**如何将素材添加到媒体库**：

```typescript
import { addFile, addFileToProject, useWebCutLibrary, useWebCutContext } from 'webcut';

const { addExistingFileToProject } = useWebCutLibrary();
const { id: projectId } = useWebCutContext();

// 方式1：添加已存在的文件到项目（推荐）
await addExistingFileToProject(fileId);

// 方式2：添加新文件到项目
await addFile(fileObject);  // 会写入 OPFS
await addFileToProject(projectId, fileId);
```

### 问题 2：创建干净的新项目（避免数据污染）

**问题分析**：
- WebCut 默认使用 `projectId = 'default'`
- 如果不传 `projectId`，所有编辑数据都会保存在默认项目中
- 第二次跳转时，会继承上一次的 rails/sources 状态

**解决方案**：每次跳转时使用**全新的 projectId**

```typescript
import { createNewProject } from 'webcut';

// 创建全新项目
const newProjectId = await createNewProject();  // 自动生成随机 ID
// 或
const newProjectId = await createNewProject('my-custom-id');  // 指定 ID

// 在组件中使用
<WebCutEditor :project-id="newProjectId" />
```

**URL 传递新项目 ID 的完整流程**：

```javascript
// ============ 外部网站 ============
function openEditorWithResources(resourceIds, timelineConfig) {
  // 1. 生成全新的项目 ID（UUID）
  const projectId = crypto.randomUUID();
  
  // 2. 准备数据
  const resources = resourceIds.map(id => ({ id, type: getResourceType(id) }));
  
  // 3. 写入 sessionStorage（包含 projectId）
  sessionStorage.setItem('webcut_project_id', projectId);
  sessionStorage.setItem('webcut_resources', JSON.stringify(resources));
  if (timelineConfig) {
    sessionStorage.setItem('webcut_timeline', JSON.stringify(timelineConfig));
  }
  
  // 4. 跳转
  window.location.href = `/editor?projectId=${projectId}`;
}

// ============ WebCut 编辑器 ============
import { createNewProject, useWebCutContext } from 'webcut';

// 在编辑器初始化时
const urlParams = new URLSearchParams(window.location.search);
const externalProjectId = urlParams.get('projectId');

if (externalProjectId) {
  // 使用外部传入的 projectId 创建项目
  await createNewProject(externalProjectId);
}

// 渲染编辑器
// <WebCutEditor :project-id="externalProjectId" />
```

**sessionStorage 完整数据格式**：

```typescript
interface ExternalImportData {
  projectId: string;        // 全新项目 ID（必填）
  resources: ExternalResource[];  // 资源列表
  timeline?: ExternalTimeline;    // 时间线配置（可选）
  clearOnLoad?: boolean;    // 是否在加载前清空
}

// sessionStorage 键名
const STORAGE_KEYS = {
  PROJECT_ID: 'webcut_project_id',
  RESOURCES: 'webcut_resources', 
  TIMELINE: 'webcut_timeline',
  CLEAR_ON_LOAD: 'webcut_clear_on_load'
};
```

---

## 实现方案

### 方案设计

#### 第一步：外部网站准备数据

在外部网站跳转到 WebCut 之前，需要：

1. **准备资源 ID 列表**：需要传递给 WebCut 的资源 ID
2. **准备 Timeline 配置**：轨道和片段的配置数据

```javascript
// 外部网站代码示例
const resources = [
  { id: 'file-001', type: 'video' },
  { id: 'file-002', type: 'audio' },
  { id: 'file-003', type: 'image' }
];

const timeline = {
  rails: [
    {
      id: 'rail-1',
      type: 'video',
      segments: [
        { id: 'seg-1', sourceKey: 'src-1', start: 0, end: 5000000 }
      ]
    },
    {
      id: 'rail-2', 
      type: 'audio',
      segments: [
        { id: 'seg-2', sourceKey: 'src-2', start: 0, end: 10000000 }
      ]
    }
  ],
  // 资源映射表
  sources: {
    'src-1': { fileId: 'file-001', type: 'video', meta: {...} },
    'src-2': { fileId: 'file-002', type: 'audio', meta: {...} }
  }
};

// 存储到 sessionStorage
sessionStorage.setItem('webcut_resources', JSON.stringify(resources));
sessionStorage.setItem('webcut_timeline', JSON.stringify(timeline));

// 跳转到 WebCut 编辑器
window.location.href = '/editor?mode=import';
```

#### 第二步：WebCut 组件接收并处理数据

创建一个包装组件或扩展机制来处理外部数据导入：

```typescript
// composables/useExternalImport.ts
import { ref, onMounted } from 'vue';
import { useWebCutContext, useWebCutPlayer } from 'webcut';
import { readFile, writeFile, createNewProject, addFileToProject, addExistingFileToProject, getFile } from 'webcut';
import { useWebCutLibrary } from 'webcut';

export interface ExternalResource {
  id: string;
  type: 'video' | 'audio' | 'image';
  name?: string;  // 可选，用于媒体库显示
}

export interface ExternalTimeline {
  rails: WebCutRail[];
  sources: Record<string, Partial<WebCutSource>>;
}

export interface ExternalImportOptions {
  /** 是否在加载前清空现有内容 */
  clearOnLoad?: boolean;
  /** 是否自动添加到媒体库 */
  addToLibrary?: boolean;
  /** 文件读取函数（必填，用于从外部系统获取文件） */
  loadFile: (fileId: string) => Promise<File | Blob | string>;
}

export function useExternalImport() {
  const { sources, rails, id: projectId } = useWebCutContext();
  const { push, clear } = useWebCutPlayer();
  const { addExistingFileToProject } = useWebCutLibrary();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 获取项目 ID（优先从 sessionStorage 获取，否则使用当前项目的 ID）
   */
  function getProjectId(): string | null {
    return sessionStorage.getItem('webcut_project_id');
  }

  /**
   * 从 sessionStorage 读取外部资源
   */
  function getExternalData(): {
    projectId: string;
    resources: ExternalResource[];
    timeline: ExternalTimeline | null;
    clearOnLoad: boolean;
  } | null {
    try {
      const projectId = sessionStorage.getItem('webcut_project_id');
      const resourcesStr = sessionStorage.getItem('webcut_resources');
      const timelineStr = sessionStorage.getItem('webcut_timeline');
      const clearOnLoad = sessionStorage.getItem('webcut_clear_on_load') === 'true';
      
      if (!projectId || !resourcesStr) return null;
      
      return {
        projectId,
        resources: JSON.parse(resourcesStr),
        timeline: timelineStr ? JSON.parse(timelineStr) : null,
        clearOnLoad
      };
    } catch (e) {
      console.error('Failed to parse external data:', e);
      return null;
    }
  }

  /**
   * 清理 sessionStorage
   */
  function clearExternalData(): void {
    sessionStorage.removeItem('webcut_project_id');
    sessionStorage.removeItem('webcut_resources');
    sessionStorage.removeItem('webcut_timeline');
    sessionStorage.removeItem('webcut_clear_on_load');
  }

  /**
   * 初始化新项目（避免数据污染）
   */
  async function initNewProject(externalProjectId?: string): Promise<string> {
    const projectId = externalProjectId || getProjectId() || crypto.randomUUID();
    await createNewProject(projectId);
    return projectId;
  }

  /**
   * 导入外部资源（媒体 + 时间轴 + 媒体库）
   * @param resources - 资源列表
   * @param options - 导入选项
   */
  async function importWithOptions(
    resources: ExternalResource[],
    options: ExternalImportOptions
  ): Promise<string[]> {
    const { clearOnLoad = true, addToLibrary = true, loadFile } = options;
    isLoading.value = true;
    error.value = null;
    const keys: string[] = [];

    try {
      // 1. 如果需要，先清空现有内容
      if (clearOnLoad) {
        clear();
      }

      // 2. 读取所有文件并写入 WebCut 的 OPFS
      // 关键：writeFile() 会计算文件的 MD5 并返回作为 fileId
      const fileIdMap: Record<string, string> = {};  // externalId -> webcutFileId
      
      for (const resource of resources) {
        try {
          const fileData = await loadFile(resource.id);
          
          // 将 Blob/File 转换为标准 File 对象（如果需要）
          const file = fileData instanceof Blob 
            ? new File([fileData], resource.name || `${resource.id}`, { type: fileData.type })
            : fileData;
            
          // 写入 WebCut 的 OPFS，返回 MD5-based fileId
          const webcutFileId = await writeFile(file as File);
          fileIdMap[resource.id] = webcutFileId;
          
        } catch (e) {
          console.warn(`Failed to load file: ${resource.id}`, e);
        }
      }

      // 3. 逐个添加素材
      for (const resource of resources) {
        const webcutFileId = fileIdMap[resource.id];
        if (!webcutFileId) continue;

        try {
          // 使用 file:{fileId} 格式，push 会从 OPFS 读取
          const sourceKey = await push(
            resource.type as any, 
            `file:${webcutFileId}` as any
          );
          keys.push(sourceKey);

          // 添加到媒体库（会自动去重）
          if (addToLibrary && webcutFileId) {
            await addFileToProject(projectId.value, webcutFileId);
          }
        } catch (e) {
          console.warn(`Failed to push resource: ${resource.id}`, e);
        }
      }
      
      return keys;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 导入外部资源（仅媒体库）- 兼容旧版
   * @param resources - 资源列表
   * @param fileReaderFn - 自定义文件读取函数
   */
  async function importResources(
    resources: ExternalResource[],
    fileReaderFn?: (id: string) => Promise<File | Blob | string>
  ): Promise<string[]> {
    return importWithOptions(resources, {
      loadFile: fileReaderFn!,
      clearOnLoad: true,
      addToLibrary: true
    });
  }

  /**
   * 导入完整 Timeline（媒体 + 时间线）
   * @param timeline - 完整的 Timeline 配置
   * @param fileReaderFn - 文件读取函数
   */
  async function importTimeline(
    timeline: ExternalTimeline,
    fileReaderFn?: (id: string) => Promise<File | Blob | string>
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // 第一步：导入所有资源并建立映射
      const keyMapping: Record<string, string> = {};
      
      // 收集所有唯一的文件 ID
      const fileIds = new Set<string>();
      for (const source of Object.values(timeline.sources)) {
        if (source.fileId) {
          fileIds.add(source.fileId);
        }
      }

      // 读取所有文件
      const fileCache: Record<string, File | Blob | string> = {};
      for (const fileId of fileIds) {
        if (fileReaderFn) {
          fileCache[fileId] = await fileReaderFn(fileId);
        } else {
          const file = await readFile(fileId);
          if (file) {
            fileCache[fileId] = file;
          }
        }
      }

      // 逐个创建素材
      for (const [oldKey, source] of Object.entries(timeline.sources)) {
        const fileData = fileCache[source.fileId || ''];
        if (!fileData) continue;

        // 使用 timeline 中指定的时间位置
        const meta = {
          ...source.meta,
          time: {
            start: timeline.rails
              .flatMap(r => r.segments)
              .find(s => s.sourceKey === oldKey)?.start,
            ...source.meta?.time
          },
          withSegmentId: timeline.rails
            .flatMap(r => r.segments)
            .find(s => s.sourceKey === oldKey)?.id
        };

        const newKey = await push(
          source.type as any, 
          fileData as any, 
          meta
        );
        keyMapping[oldKey] = newKey;
      }

      // 第二步：更新轨道的 sourceKey 映射
      // 注意：由于 push() 会自动创建 segment，我们只需要确保时间正确
      // 如果需要精确控制 segment，需要直接操作 rails
      
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 直接设置 Rails（完全自定义时间线）
   * 适用于外部已完全配置好 Timeline 的情况
   */
  async function setRailsFromExternal(
    timeline: ExternalTimeline,
    fileReaderFn?: (id: string) => Promise<File | Blob | string>
  ): Promise<void> {
    isLoading.value = true;

    try {
      // 1. 先读取所有文件并创建 sources
      const fileIds = [...new Set(
        Object.values(timeline.sources)
          .map(s => s.fileId)
          .filter(Boolean) as string[]
      )];

      const fileCache: Record<string, File | Blob | string> = {};
      for (const fileId of fileIds) {
        if (fileReaderFn) {
          fileCache[fileId] = await fileReaderFn(fileId);
        } else {
          const file = await readFile(fileId);
          if (file) fileCache[fileId] = file;
        }
      }

      // 2. 使用 pushSeries 按顺序添加素材，保持时间连续性
      // 这里需要根据 timeline 中定义的 segment 顺序来添加
      
      // 或者更简单地：直接操作 context.rails
      // 但这需要确保 sources 已正确创建
      
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading,
    error,
    getExternalData,
    clearExternalData,
    importResources,
    importTimeline,
    setRailsFromExternal
  };
}
```

#### 第三步：在编辑器组件中使用

```vue
<script setup lang="ts">
import { onMounted, watch, ref } from 'vue';
import { WebCutEditor, createNewProject } from 'webcut';
import { useExternalImport } from './composables/useExternalImport';

const props = defineProps<{
  // 必填：自定义文件读取回调（从外部系统获取文件）
  loadFile: (fileId: string) => Promise<File | Blob | string>;
  // 可选：外部传入的项目 ID
  externalProjectId?: string;
}>();

// 用于控制编辑器使用哪个 projectId
const editorProjectId = ref<string | undefined>(undefined);

const { 
  getExternalData, 
  getProjectId,
  clearExternalData, 
  importWithOptions,
  initNewProject
} = useExternalImport();

onMounted(async () => {
  // 1. 获取外部传入的项目 ID
  const urlParams = new URLSearchParams(window.location.search);
  const urlProjectId = urlParams.get('projectId');
  
  // 2. 优先使用 URL 参数，否则使用 sessionStorage，否则创建新的
  let projectId = urlProjectId || getProjectId();
  
  if (projectId) {
    // 确保项目存在
    await createNewProject(projectId);
  } else {
    // 创建全新项目
    projectId = await initNewProject();
  }
  
  editorProjectId.value = projectId;
  
  // 3. 检查是否有外部数据需要导入
  const externalData = getExternalData();
  
  if (!externalData) {
    console.log('No external data found');
    return;
  }

  // 4. 导入资源（包含添加到媒体库）
  await importWithOptions(externalData.resources, {
    loadFile: props.loadFile,
    clearOnLoad: externalData.clearOnLoad,
    addToLibrary: true  // 关键：确保添加到媒体库
  });

  // 5. 清理 sessionStorage
  clearExternalData();
});
</script>

<template>
  <!-- 使用全新的 projectId -->
  <WebCutEditor :project-id="editorProjectId" v-bind="$attrs" />
</template>
```

**简化版（推荐）**：

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { WebCutEditor, createNewProject } from 'webcut';
import { useExternalImport } from './composables/useExternalImport';

const props = defineProps<{
  loadFile: (fileId: string) => Promise<File | Blob | string>;
}>();

const { getExternalData, clearExternalData, importWithOptions, initNewProject } = useExternalImport();

const projectId = ref<string>();

onMounted(async () => {
  const data = getExternalData();
  if (!data) {
    // 无外部数据，创建新项目后正常加载
    projectId.value = await initNewProject();
    return;
  }

  // 创建/确保项目存在
  await createNewProject(data.projectId);
  projectId.value = data.projectId;

  // 导入资源（自动添加到媒体库和时间轴）
  await importWithOptions(data.resources, {
    loadFile: props.loadFile,
    clearOnLoad: data.clearOnLoad,
    addToLibrary: true
  });

  clearExternalData();
});
</script>

<template>
  <WebCutEditor v-if="projectId" :project-id="projectId" v-bind="$attrs" />
  <div v-else>Loading...</div>
</template>
```

---

## 数据格式规范

### sessionStorage 数据格式

> **重要**：必须在所有键中传递 `projectId`，这是创建干净项目和避免数据污染的关键！

#### webcut_project_id（必填）

```json
"550e8400-e29b-41d4-a716-446655440000"
```

#### webcut_resources

```json
[
  {
    "id": "file-001",
    "type": "video",
    "name": "视频1.mp4",
    "duration": 10000000
  },
  {
    "id": "file-002", 
    "type": "audio",
    "name": "音频1.mp3"
  },
  {
    "id": "file-003",
    "type": "image", 
    "name": "图片1.png"
  }
]
```

#### webcut_timeline

```json
{
  "rails": [
    {
      "id": "rail-video-1",
      "type": "video",
      "main": true,
      "segments": [
        {
          "id": "seg-1",
          "sourceKey": "src-1",
          "start": 0,
          "end": 5000000
        },
        {
          "id": "seg-2", 
          "sourceKey": "src-3",
          "start": 5000000,
          "end": 8000000
        }
      ],
      "transitions": []
    },
    {
      "id": "rail-audio-1",
      "type": "audio",
      "segments": [
        {
          "id": "seg-3",
          "sourceKey": "src-2",
          "start": 0,
          "end": 10000000
        }
      ]
    }
  ],
  "sources": {
    "src-1": {
      "fileId": "file-001",
      "type": "video",
      "meta": {
        "rect": { "x": 0, "y": 0, "w": 1920, "h": 1080 },
        "opacity": 1,
        "time": { "playbackRate": 1 }
      }
    },
    "src-2": {
      "fileId": "file-002",
      "type": "audio",
      "meta": {
        "audio": { "volume": 0.8 }
      }
    },
    "src-3": {
      "fileId": "file-003", 
      "type": "image",
      "meta": {
        "autoFitRect": "contain"
      }
    }
  }
}
```

---

## 实现步骤

### 步骤 1：在外部网站实现数据传递

```javascript
// 外部网站代码
function openEditorWithResources(resourceIds, timelineConfig = null) {
  // 1. 【关键】生成全新的项目 ID（UUID），避免数据污染
  const projectId = crypto.randomUUID();
  
  // 2. 准备资源列表
  const resources = resourceIds.map(id => ({
    id,
    type: getResourceType(id), // video/audio/image
    name: getResourceName(id)  // 可选，用于媒体库显示
  }));
  
  // 3. 写入 sessionStorage（必须包含 projectId）
  sessionStorage.setItem('webcut_project_id', projectId);
  sessionStorage.setItem('webcut_resources', JSON.stringify(resources));
  sessionStorage.setItem('webcut_clear_on_load', 'true');  // 每次都先清空
  
  if (timelineConfig) {
    sessionStorage.setItem('webcut_timeline', JSON.stringify(timelineConfig));
  }
  
  // 4. 【关键】URL 也需要传递 projectId（作为备份）
  window.location.href = `/webcut-editor?projectId=${projectId}`;
}
```

**URL 参数说明**：

| 参数 | 必填 | 说明 |
|------|------|------|
| `projectId` | ✅ 是 | 全新生成的 UUID，用于创建干净的项目 |
| `mode` | 否 | `import` 或 `edit`，控制编辑器模式 |

**完整 URL 示例**：

```
https://your-site.com/webcut-editor?projectId=550e8400-e29b-41d4-a716-446655440000&mode=import
```

### 步骤 2：创建导入组件

在 WebCut 项目中创建 `ExternalImportWrapper.vue`：

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useExternalImport } from '@/composables/useExternalImport';

const props = defineProps<{
  loadFile?: (id: string) => Promise<File | Blob | string>;
}>();

const emit = defineEmits(['import-complete', 'import-error']);

const { 
  getExternalData, 
  clearExternalData, 
  importResources, 
  importTimeline 
} = useExternalImport();

onMounted(async () => {
  try {
    const data = getExternalData();
    if (!data) return;

    if (data.timeline) {
      await importTimeline(data.timeline, props.loadFile);
    } else if (data.resources.length) {
      await importResources(data.resources, props.loadFile);
    }

    clearExternalData();
    emit('import-complete');
  } catch (e: any) {
    emit('import-error', e);
  }
});
</script>

<template>
  <!-- 这是一个无渲染组件，只负责导入逻辑 -->
  <slot />
</template>
```

### 步骤 3：创建自定义入口组件

```vue
<!-- ExternalEditor.vue -->
<script setup lang="ts">
import WebCutEditor from './WebCutEditor.vue';
import ExternalImportWrapper from './ExternalImportWrapper.vue';

defineProps<{
  loadFile?: (id: string) => Promise<File | Blob | string>;
}>();
</script>

<template>
  <ExternalImportWrapper :load-file="loadFile">
    <WebCutEditor />
  </ExternalImportWrapper>
</template>
```

### 步骤 4：外部网站调用方式

```javascript
// 方式1：通过 URL 参数 + 外部提供文件读取服务
// 外部网站跳转到: https://your-site.com/editor?external=true

// 方式2：通过 postMessage 传递（更安全）
window.addEventListener('message', async (event) => {
  if (event.data.type === 'IMPORT_RESOURCES') {
    const { resources, timeline } = event.data;
    sessionStorage.setItem('webcut_resources', JSON.stringify(resources));
    if (timeline) {
      sessionStorage.setItem('webcut_timeline', JSON.stringify(timeline));
    }
  }
});
```

---

## 进阶功能

### 1. 通过 URL 参数控制行为

```typescript
// URL 参数示例
// /editor?mode=import&clear=true&autostart=true

interface EditorParams {
  mode: 'edit' | 'import';       // 编辑模式 或 导入模式
  clear: boolean;                 // 是否先清空现有内容
  autostart: boolean;            // 导入后是否自动播放
  aspectRatio: '16:9' | '4:3' | '9:16';  // 画布比例
}
```

### 2. 双向同步（可选）

如果需要将编辑结果同步回外部系统：

```typescript
// 导出编辑结果
function exportToExternal(): ExternalTimeline {
  const { sources, rails } = useWebCutContext();
  
  // 将 sources 和 rails 序列化为外部格式
  return {
    rails: rails.value,
    sources: Object.fromEntries(
      [...sources.value.entries()].map(([key, source]) => [
        key,
        {
          fileId: source.fileId,
          type: source.type,
          meta: source.meta
        }
      ])
    )
  };
}

// 通过 postMessage 发送回外部网站
window.parent.postMessage({
  type: 'EXPORT_TIMELINE',
  data: exportToExternal()
}, '*');
```

### 3. 安全考虑

```typescript
// 验证外部数据来源
function validateExternalData(origin: string): boolean {
  const allowedOrigins = ['https://your-website.com', 'https://admin.your-website.com'];
  return allowedOrigins.includes(origin);
}

// 在接收 postMessage 时验证
window.addEventListener('message', (event) => {
  if (!validateExternalData(event.origin)) {
    console.warn('Blocked message from untrusted origin');
    return;
  }
  // 处理消息...
});
```

---

## 时间单位说明

**重要**：WebCut 内部所有时间单位均为**纳秒（nanoseconds）**

```
1 秒 = 1,000,000,000 纳秒 (1e9)
1 毫秒 = 1,000,000 纳秒 (1e6)
```

在设置时间相关参数时需要注意转换：

```javascript
// JavaScript 示例
const seconds = 5;
const nanoseconds = seconds * 1000000; // 5 * 1e6 = 5000000

// 或
const nanoseconds = seconds * 1e6;
```

---

## 总结

本方案通过以下方式实现外部资源集成：

1. **sessionStorage + URL** 作为数据传递通道（包含 projectId）
2. **createNewProject(projectId)** 创建全新项目，避免数据污染
3. **useWebCutPlayer.push()** 添加素材到 Canvas 和时间轴
4. **addExistingFileToProject()** 手动添加到媒体库
5. **Timeline 配置** 预定义轨道和片段
6. **自定义包装组件** 处理导入逻辑

### 关键要点总结

| 需求 | 解决方案 |
|------|----------|
| 素材在时间轴显示 | ✅ `push()` 自动处理 |
| 素材在画布显示 | ✅ `push()` 自动处理 |
| 素材在媒体库显示 | ❌ 需调用 `addExistingFileToProject()` |
| 避免数据污染 | 每次跳转使用全新 `projectId`（UUID） |
| 清理旧数据 | `clear()` 或 `createNewProject()` |

### 完整数据流

```
外部网站                                    WebCut 编辑器
    │                                             │
    │  1. 生成 projectId (UUID)                    │
    │  2. 写入 sessionStorage                     │
    │  3. 跳转 (URL?projectId=xxx)                │
    │ ───────────────────────────────────────>   │
    │                                             │ onMounted
    │                                             │ 读取 sessionStorage
    │                                             │
    │                                             │ createNewProject(projectId)
    │                                             │ 
    │                                             │ for each resource:
    │                                             │   loadFile(id) → 获取文件
    │                                             │   push(type, file) → 添加到时间轴+画布
    │                                             │   addToProject(id) → 添加到媒体库
    │                                             │
    │                                             │ 渲染完成
    │                                             │
```

### 最小化集成示例

```javascript
// ============ 外部网站 ============
// 一行代码跳转
openEditor(['file-001', 'file-002'], timeline);

// ============ WebCut 组件 ============
<template>
  <WebCutEditor 
    :project-id="projectId" 
    @created="onEditorReady"
  />
</template>

<script setup>
const projectId = ref();

onMounted(async () => {
  const data = getExternalData();
  if (!data) {
    projectId.value = await createNewProject();
    return;
  }
  
  await createNewProject(data.projectId);
  projectId.value = data.projectId;
  
  // loadFile 从外部获取文件
  await importWithOptions(data.resources, { loadFile, addToLibrary: true });
  
  clearExternalData();
});
</script>
```

核心优势：
- ✅ 无需修改 WebCut 核心代码
- ✅ 支持多种数据格式（File/Base64/URL）
- ✅ 媒体库和时间轴都能正确展示
- ✅ 每次跳转都是全新项目，数据隔离
- ✅ 可扩展的文件读取接口

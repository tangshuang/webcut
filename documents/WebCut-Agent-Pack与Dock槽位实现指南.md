# WebCut Agent Pack 与 Dock 槽位实现指南

## 1. 概述

WebCut 提供两层扩展能力：

- **ExtensionPack**（轨道级扩展）：自定义素材类型、轨道管理器、编辑面板等，详见 [`WebCut-ExtensionPack扩展开发指南.md`](./WebCut-ExtensionPack扩展开发指南.md)。
- **Dock 槽位 + Agent Pack**（编辑器级扩展）：在编辑器右侧外缘挂载一组**垂直居中**的悬浮按钮，点击展开各自的可收起右侧边栏。内置的 **Agent Pack** 是 Dock 槽位的第一个消费者，提供一个「AI 剪辑助手」边栏，能通过自然语言驱动时间轴操作。

本文档描述 Dock 槽位机制、内置 Agent Pack 的实现，以及外部应用如何接入。

### 1.1 设计要点

| 关注点 | 设计 |
|---|---|
| 槽位形态 | 编辑器右侧外缘一组悬浮按钮（整组 `position:absolute; top:50%; transform:translateY(-50%)` 垂直居中、纵向堆叠），点击展开各自的右侧边栏；同一时刻最多展开一个 |
| 工具执行 | **全部前端驻留执行**——剪辑器状态（rails/sources/cursor）在浏览器，后端够不到；agent 循环跑在前端 |
| 后端 | **无状态 LLM 网关**：只负责加载随包 system prompt、转发 `{messages, tools}` 给 LLM、原样 SSE 透传 LLM 输出 |
| 系统提示词 | 随包提供（`packs/agent/prompts/system-prompt.md`），前后端单一信息源，mtime 缓存 |
| 工具来源 | 内置 webcut 编辑工具 + 加载时注入的额外工具，schema 与执行器同源 |
| 依赖 | webcut 是开源库，Agent Pack 仅依赖 naive-ui 与 webcut 内部基建 |

---

## 2. Dock 槽位机制

Dock 不是一套独立的 pack 体系，而是 `WebCutExtensionPack` 的一个**可选配置字段** `dockConfig`——和 `materialConfig` / `libraryConfig` / `managerConfig` / `panelConfig` 同级。任意 pack 都可以声明 `dockConfig`（既可只声明 dock，也可与其它配置同时声明），通过现有的 `packs` 数组注册。

### 2.1 核心接口

定义在 [`opensource/webcut/src/types/index.ts`](../src/types/index.ts)：

```typescript
export interface WebCutExtensionPack {
    materialConfig?: { ... };
    libraryConfig?: { ... };
    managerConfig?: { ... };
    panelConfig?: { ... };
    /**
     * 编辑器右侧 dock 槽位配置（悬浮按钮 + 可展开边栏，可多个，整组垂直居中）。
     * 任意 pack 都可声明 dockConfig；编辑器扫描 modules 取所有声明了 dockConfig 的 pack 渲染按钮组。
     * 所有 dock 按钮共用统一的「右侧贴边竖向 tab 拉手」样式，pack 只提供 icon 和文字，不能自定义整个按钮。
     */
    dockConfig?: {
        /** 唯一 key，用于按钮组内识别与展开态切换 */
        key: string;
        /** 右侧边栏主组件（展开时渲染） */
        sidebar: Component;
        /** 触发按钮顶部图标 */
        triggerIcon?: Component;
        /** 触发按钮文字（旋转 90° 竖排显示在 icon 下方，可不传） */
        triggerText?: string;
        /** 边栏宽度，默认 400 */
        width?: number;
    };
    languagePackages?: Record<string, Record<string, string>>;
    onRegister?(context: WebCutContext): Promise<void>;
    // ...
}
```

`WebCutContext` 只保留**一个** dock 运行时字段（不再有 dockPacks 列表——dock pack 列表由 `modules` 中声明 `dockConfig` 的 pack 直接派生）：

```typescript
export type WebCutContext = {
    // ...原有字段
    /** 当前展开的 dock pack key（同一时刻最多展开一个） */
    activeDockKey: null | string;
};
```

### 2.2 注册

dock pack 走与素材库/轨道/面板 pack **完全相同**的注册通路：`<WebCutEditor :packs="[...]">` → `registerExtensionPack` → 落 `context.modules`。`registerExtensionPack`（[`opensource/webcut/src/hooks/index.ts`](../src/hooks/index.ts)）不做任何 dock 默认展开处理——dock 不允许自行声明「默认打开」：

```typescript
async function registerExtensionPack(mod: new () => WebCutExtensionPack) {
    if (modules.value.has(mod)) return;
    const inst = new mod();
    // ...materialConfig.thingType 唯一性检查、modules.value.set、mergeLangPkg 等不变
    await inst.onRegister?.(finalContext!);
}
```

初始展开哪一个 dock **完全由 localStorage 决定**：编辑器把当前展开的 dock key 写入 `localStorage[WEBCUT_DOCK_ACTIVE:<projectId>]`，刷新后读取，**只有 key 相等的那个 dock 才会展开**（dock 之间互斥，同一时刻最多一个展开）。没有任何 pack 自带的 defaultOpen 参数。

没有 `registerDockPack` / `openDock` / `closeDock` / `toggleDock` 等独立 API——dock 切换由编辑器组件本地直接读写 `activeDockKey`。

### 2.3 编辑器渲染槽位

在 [`opensource/webcut/src/views/editor/index.vue`](../src/views/editor/index.vue)：`WebCutEditor` 不再有 `docks` prop，dock pack 与其它 pack 一起通过 `packs` 传入。编辑器扫描 `modules` 取出声明了 `dockConfig` 的 pack，本地 computed 出按钮组与激活项：

```typescript
const { registerExtensionPack, id, modules, activeDockKey } = useWebCutContext();
if (props.packs) props.packs.forEach(mod => registerExtensionPack(mod));

// dock 槽位：扫描已注册 pack 中声明了 dockConfig 的
const dockPacks = computed(() =>
    [...modules.value.values()]
        .filter((m) => m.dockConfig)
        .map((m) => ({ inst: m, cfg: m.dockConfig! }))
);
const activeDock = computed(() =>
    dockPacks.value.find((d) => d.cfg.key === activeDockKey.value) || null
);
function toggleDock(key: string) { activeDockKey.value = activeDockKey.value === key ? null : key; }
function closeDock()             { activeDockKey.value = null; }

// dock 展开态持久化到 localStorage（按项目 id 隔离），刷新后恢复上次的展开状态
const dockStorageKey = computed(() => `WEBCUT_DOCK_ACTIVE:${id.value}`);
try {
    const saved = localStorage.getItem(dockStorageKey.value);
    if (saved !== null) {
        activeDockKey.value = saved && dockPacks.value.some((d) => d.cfg.key === saved) ? saved : null;
    }
} catch {}
watch(activeDockKey, (v) => {
    try { localStorage.setItem(dockStorageKey.value, v || ''); } catch {}
});
```

模板结构（关键部分）——触发按钮组放在 `.webcut-editor` **内部**，使其始终贴「编辑器」右侧边缘（而非屏幕右侧），边栏展开时按钮仍可见；主色通过内联 CSS 变量注入（theme-box 未暴露 `--webcut-primary-color`，直接用会失效导致透明背景）：

```html
<div class="webcut-editor-root">
    <div class="webcut-editor">
        …n-split 编辑器内容…
        <!-- 主色由 themeColors 注入为 CSS 变量 -->
        <div class="webcut-dock-trigger-group" v-if="dockPacks.length"
             :style="{ '--webcut-dock-primary': themeColors.primaryColor,
                        '--webcut-dock-primary-hover': themeColors.primaryColorHover }">
            <button v-for="d in dockPacks" :key="d.cfg.key"
                    class="webcut-dock-trigger-btn"
                    :class="{ active: d.cfg.key === activeDockKey }"
                    @click="toggleDock(d.cfg.key)">
                <component v-if="d.cfg.triggerIcon" :is="d.cfg.triggerIcon" class="webcut-dock-trigger-icon" />
                <span v-if="d.cfg.triggerText" class="webcut-dock-trigger-text">{{ d.cfg.triggerText }}</span>
            </button>
        </div>
    </div>

    <!-- 抽屉边栏：容器 width 过渡推动 editor、内层 translateX 滑动，组成抽屉效果；
         关闭时延迟卸载内容（displayedDock），让滑出动画跑完 -->
    <aside class="webcut-dock-sidebar" v-if="dockPacks.length"
           :class="{ open: !!activeDock }"
           :style="{ '--webcut-dock-w': activeDockWidth + 'px' }">
        <div class="webcut-dock-sidebar-inner" :class="{ open: !!activeDock }">
            <component v-if="displayedDock" :is="displayedDock.cfg.sidebar" :pack="displayedDock.inst" @close="closeDock()" />
        </div>
    </aside>
</div>
```

**抽屉过渡**（容器 `width 0 ↔ --webcut-dock-w` 推动 editor；内层固定宽 + `translateX 100% ↔ 0` 滑动；同步用 easeOutQuint 缓动 `cubic-bezier(0.22, 1, 0.36, 1)` 0.34s 形成「缓冲感」；`overflow:hidden` 裁掉滑出的内层）：

```css
.webcut-dock-sidebar {
    width: 0; overflow: hidden;
    transition: width 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.webcut-dock-sidebar.open { width: var(--webcut-dock-w, 420px); }
.webcut-dock-sidebar-inner {
    width: var(--webcut-dock-w, 420px); height: 100%;
    transform: translateX(100%);
    transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.webcut-dock-sidebar-inner.open { transform: translateX(0); }
```

> 关闭时若直接 `v-if` 卸载内容，滑出动画会看到空容器。编辑器用 `displayedDock` shallowRef：开启立即渲染、关闭延迟 ~340ms（过渡结束后）卸载，保证关闭也有完整抽屉滑出效果。

**统一按钮样式**（参考 vee 现有的悬浮按钮：右侧贴边竖向 tab 拉手，左半圆，主色 + 阴影；高度自适应 icon+文字；文字旋转 90° 竖排；默认半透明、激活态 opacity:1 高亮）：

```css
.webcut-dock-trigger-group {
    position: absolute; right: 0; top: 50%;
    transform: translateY(-50%);
    display: flex; flex-direction: column; align-items: flex-end;
    gap: 10px; z-index: 20000;
}
.webcut-dock-trigger-btn {
    min-width: 20px;                    /* 收窄：更瘦的 tab 拉手 */
    padding: 8px 2px;
    border: none;
    border-radius: 50% 0 0 50%;         /* 左侧半圆、右侧贴边 */
    background-color: var(--webcut-dock-primary, #00b4a2);  /* 主色由内联变量注入 */
    color: #fff;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px;
    opacity: 0.75;                      /* 默认半透明；激活态提到 1 高亮 */
}
.webcut-dock-trigger-btn:hover  { opacity: 0.92; transform: translateX(-2px); background-color: var(--webcut-dock-primary-hover, #01a595); }
.webcut-dock-trigger-btn.active { opacity: 1; }
.webcut-dock-trigger-text {
    writing-mode: vertical-rl;
    text-orientation: sideways;         /* 整体旋转 90° 的纵向排版 */
    font-size: 12px; letter-spacing: 1px; white-space: nowrap;
}
```

> - 同一时刻最多展开一个边栏；点击当前已展开的按钮收起、点击其它按钮切换。
> - 展开态写入 `localStorage[WEBCUT_DOCK_ACTIVE:<projectId>]`，刷新后恢复。
> - 按钮始终贴编辑器右侧边缘，边栏展开时按钮被推到边栏左侧仍可见。
> - 主色用 `themeColors.value.primaryColor` 内联注入为 `--webcut-dock-primary`，浅/深色模式下都保证可见（不能直接用 `var(--webcut-primary-color)`，theme-box 未定义该变量）。

---

## 3. 内置 Agent Pack

源码目录：[`opensource/webcut/src/packs/agent/`](../src/packs/agent/)

### 3.1 文件结构

```
opensource/webcut/src/packs/agent/
├── index.ts                  # createWebCutAgentPack 工厂，产出 implements WebCutExtensionPack（仅声明 dockConfig）的类
├── adapter.ts                # WebCutAgentAdapter 契约 + SSE 事件协议类型
├── tools.ts                  # WebCutAgentTool 类型 + 工具注册表（内置 + 注入合并）
├── tools-builtin.ts          # 内置 webcut 编辑工具（前端执行器）
├── store.ts                  # pack 内 store（chats/messages/状态，provide/inject）
├── loop.ts                   # 前端 agent 循环 + buildRequestMessages
├── prompts/
│   └── system-prompt.md      # 随包系统提示词（后端加载后作为 LLM system prompt）
├── i18n.ts                   # 默认语言包（webcut.agent.* 前缀）
├── components/
│   ├── sidebar.vue           # 边栏外壳（顶部操作 + init/messages-view 切换）
│   ├── agent-icon.vue        # dock 触发按钮图标（sparkle；按钮外壳由 WebCutEditor 统一渲染）
│   ├── messages-view.vue     # 消息流 + 输入 + thinking + 发送/停止
│   ├── init.vue              # 空会话引导
│   ├── chats-popover.vue     # 历史会话切换浮层
│   └── thinking-text.vue     # 流光思考文字
└── utils/（预留）
```

### 3.2 Adapter 契约（keystone）

Agent Pack 通过 adapter 与后端解耦。adapter 是一个**无状态 LLM 网关**，由调用方实现。定义在 [`adapter.ts`](../src/packs/agent/adapter.ts)：

```typescript
export type WebCutAgentEvent =
    | { type: 'reasoning'; content: string }            // 思考链
    | { type: 'content'; content: string }              // 正文流式
    | { type: 'tool_call'; tool: string; callId: string; input: any }
    | { type: 'usage'; data: { inputTokens: number; outputTokens: number } }
    | { type: 'end' }
    | { type: 'error'; data: any }
    | { type: 'completion_start' | 'completion_end' | 'message' | 'warn' | 'abort' | 'close' | 'http_abort' | 'http_error'; data?: any };

export interface WebCutAgentStream {
    on(name: string, cb: (e: any) => void): this;
    off(name: string, cb: (e: any) => void): this;
    close(): void;
}

export interface WebCutAgentAdapter {
    /** 本轮 LLM 请求：无状态网关 */
    sendLLMRequest(params: {
        messages: any[];                                  // OpenAI 风格消息数组
        tools?: { name: string; description: string; parameters: object }[];
        model?: string;
        enableThinking?: boolean;
        extra?: Record<string, any>;
    }): WebCutAgentStream;
    abort(): void;
    listModels?(): Promise<any[]>;
    renderMessage?: (msg: any) => Component | string;     // 自定义消息渲染（如 markdown）
    fileUrl?: (file: string) => string;
}
```

> chats / messages 持久化**不走后端**——由 pack 内 store 自管。

### 3.3 工具注册表

[`tools.ts`](../src/packs/agent/tools.ts) 定义工具类型与运行时：

```typescript
export interface WebCutAgentToolRuntime {
    ctx: WebCutContext;                  // 响应式剪辑器上下文（rails/sources/cursorTime/width/height/...）
    push(type, source, meta?): Promise<string>;   // 推素材到时间轴，返回 sourceKey
    remove(sourceKey: string): void;
    updateByAspectRatio(ratio: string): Promise<void>;
    seekCursor(timeMicroseconds: number): void;
}

export interface WebCutAgentTool<I = any, R = any> {
    name: string;                        // 全局唯一，建议命名空间前缀，如 webcut.add_text_segment
    description: string;                 // 给 LLM 的工具说明
    parameters: object;                  // JSON schema
    execute(runtime: WebCutAgentToolRuntime, input: I): Promise<R> | R;  // 前端驻留执行器
}
```

`createToolRegistry(builtin, injected)` 合并内置 + 调用方注入的工具，按 `name` 去重（注入不得覆盖内置同名）。**每个工具同时是 schema（喂给 LLM）+ 前端执行器**——单一信息源。

### 3.4 内置工具

工具集源码在 [`tools-builtin/`](../src/packs/agent/tools-builtin/) 目录，按职责分文件，由 [`index.ts`](../src/packs/agent/tools-builtin/index.ts) 的 `createBuiltinTools()` 聚合（~30 个），全部对 `WebCutAgentToolRuntime` 操作、不调后端。统一 `webcut.*` 命名前缀；时间参数一律微秒（1e6=1秒）。

| 分类（文件） | 工具 |
|---|---|
| **query**（只读） | `get_timeline_state`、`get_player_state`（cursor/scale/status/canUndo）、`get_library`（媒体库文件）、`get_selection`（当前选中详情）、`list_effects`（转场/滤镜/动画清单）、`list_history` |
| **timeline**（增删改拆） | `add_text_segment`、`add_media_from_library`、`push_media`、`push_series`、`delete_segment`（**用 manager.deleteSegment，正确清 rail**）、`split_segment`、`update_text`、`update_segment_props`（rect/opacity/volume/playbackRate）、`set_filters`、`clear_timeline` |
| **effects** | `apply_animation`、`remove_animation`、`apply_transition`、`remove_transition`、`separate_audio`、`repair_pitch` |
| **rail** | `set_rail_mute`、`set_rail_hidden`、`magnet_main_video`、`set_aspect_ratio` |
| **view** | `seek_cursor`、`set_scale`、`play`、`pause`、`reset` |
| **history** | `undo`、`redo`、`recover_to_history` |
| **export** | `export_video` |

> 修改类工具 description 末尾统一带提示「修改后建议调 get_timeline_state / get_player_state 刷新上下文」，配合首轮注入策略。`add_text_segment` 等的传参遵循 webcut 原生 push meta：起点走 `meta.time.start`，目标轨道走 `meta.withRailId`。

#### 四通道上下文模型

LLM 通过 4 个通道获取信息：

| 通道 | 内容 | 注入位置 | 节奏 |
|---|---|---|---|
| ① 行为 system prompt | 角色、工具选择指南、时间单位、安全约束 | 后端 `prompts/system-prompt.md`（随包） | 每轮 prepend（后端） |
| ② 动态上下文快照 | 画布/比例/fps/总时长、游标/缩放/选中、轨道片段摘要、媒体库摘要、可用特效清单 | pack 在 loop 内拼成 system 消息插到 messages 头（[`context-snapshot.ts`](../src/packs/agent/context-snapshot.ts)） | **每轮对话首轮注入一次** |
| ③ 工具 catalog | ~30 个工具 schema | `registry.schemas()` 随每轮 `tools` | 每轮 |
| ④ 工具结果 | 工具执行 JSON 返回 | `{role:'tool',...}` 追加 messages | 每次调用后 |

> 策略：首轮注入快照建立基线；本轮内状态不自动刷新，LLM 改动后须主动调 `get_timeline_state` / `get_player_state` 验证（system prompt 明确告知）。library 超过 50 项时快照截断 + total。

### 3.5 前端 agent 循环

[`loop.ts`](../src/packs/agent/loop.ts) 是核心。所有工具调用与多轮对话都在前端驱动：

```
输入：用户 prompt
1. push 用户消息
2. sendLLMRequest({ messages, tools: registry.schemas(), model, enableThinking })
3. 监听流：
   - reasoning → 写入思考链
   - content   → 累积到当前 assistant message
   - tool_call → 累积待执行调用列表（同时写入 assistant.tool_calls）
   - usage     → 仅记录（计费在后端）
   - end / abort / close / http_* → 结束本轮
4. 若本轮收到 tool_call：
   - 按顺序在本地执行（查工具注册表，传 runtime）
   - 追加 {role:'tool', tool_call_id, content: JSON.stringify(result)}
   - 回到 2
5. 否则：终结
```

关键实现点：

- **请求消息构造顺序**：先把当前已确定的消息序列 `buildRequestMessages` 后，再 push 本轮空 assistant 消息，避免把空 pending assistant 带进请求（[`loop.ts` runOnce](../src/packs/agent/loop.ts)）。
- **首轮上下文注入**：每个用户回合（`send()`）复位 `injectedThisTurn`；`runOnce` 仅在首次构造请求时 `unshift` 一条 `{role:'system', content: '<webcut-context>...</webcut-context>'}`（由 [`buildContextSnapshot`](../src/packs/agent/context-snapshot.ts) 产出），同回合后续轮次不再注入。
- **整轮历史**：`send()` 的 `finally` 调一次 `runtime.history.push({ title: prompt.slice(0,40) })`（[history.ts push](../src/hooks/history.ts) 内部 diff，无变化返回 null 不入栈）→ 用户一次回退整轮 agent 操作。
- **多轮上限**：`MAX_DEPTH = 8`，防止 tool 死循环。
- **兜底超时**：单轮 120s 强制结束。
- **`buildRequestMessages`**：转 OpenAI 风格——user/assistant/tool，assistant 的 tool_calls 转成 `{id, type:'function', function:{name, arguments}}`。

### 3.6 store 与状态保持

[`store.ts`](../src/packs/agent/store.ts) 用 Vue refs + provide/inject 实现（不使用 pinia）：

- `chats`（多会话）、`currentChatId`、`messages`（computed，当前会话）、`isThinking`/`isRuning`/`enableThinking`/`model`。
- `createWebCutAgentStore()` 在边栏首次挂载时创建并 `provide`。

**跨开关保留会话**：边栏组件 unmount/remount 时，store + loop 缓存在 pack 实例的 `__agentRuntime__` 上（pack 实例由 `registerExtensionPack` markRaw 常驻 `context.modules`），重挂时复用并通过 `provideWebCutAgentStore(store)` 在当前实例重新 provide。这样收起→重开边栏，对话不丢失。

### 3.7 sidebar 组装

[`components/sidebar.vue`](../src/packs/agent/components/sidebar.vue) setup 内：

1. 从 props 拿 pack 实例，取 `adapter` / `registry`。
2. `inject('WEBCUT_CONTEXT')` 取 raw 响应式上下文；`useWebCutContext()` / `useWebCutPlayer()` 取 `updateByAspectRatio` / `push` / `remove` / `moveTo`，组装 `WebCutAgentToolRuntime`。
3. 复用或创建 `store` + `loop`（缓存到 pack 实例）。
4. `provide(AGENT_PACK_KEY, agentPack)`，供 messages-view 取 `adapter.renderMessage`。

### 3.8 system prompt

[`prompts/system-prompt.md`](../src/packs/agent/prompts/system-prompt.md) 描述 agent 角色、工具调用规范、时间单位（微秒）、工作流、回复风格。前端 pack 不需要它（messages 由前端构造）；**后端启动时按 webcut 模块路径读取本文件、mtime 缓存**，作为 LLM 端点的 system prompt。修改 prompt 即对端点即时生效（重启或文件变更失效缓存）。

### 3.9 选中素材与 @mention

用户在时间轴多选素材（`ctx.selected` + `ctx.current`）后，agent 输入框联动：

- **选中栏（输入框顶部）**：列出当前多选的素材，每项带 1-based 序号 `@N`、名称、×。
- **@引用**：在输入框敲 `@` 触发下拉，列出当前选中素材供挑选；点击或回车在光标处插入 `@N `（实现：[`composables/use-selection-mention.ts`](../src/packs/agent/composables/use-selection-mention.ts) 的 `detectMention`/`pickMention`，检测光标前最后一个由空白引导的 `@`）。
- **移除（×）**：`removeMaterial(item)` 同步做两件事——① 调 `runtime.unselectSegment` 反选（与编辑器联动）；② 用正则 `@N\s?` 清理输入框里对该序号的引用。
- **提交**：`buildSubmitText(prompt)` 解析 prompt 中的 `@N`，把「所有选中素材」+「被 @ 引用的子集」拼成 `<user-focus>` JSON 块附加到 prompt 末尾一并提交（无选中则原样发送）。

runtime 通过 [sidebar.vue](../src/packs/agent/components/sidebar.vue) `provide(AGENT_RUNTIME_KEY, runtime)` 注入；messages-view 与 init 均 `inject` 后用 `useSelectionMention(runtime, text)` 复用同一逻辑。

> 序号按 `ctx.selected` 数组顺序 1-based；移除某项后其后 `@M` 引用的语义会随数组重排而变化（MVP 接受；如需稳定可改为按 sourceKey 引用）。system prompt 已告知 LLM「用户消息中的 `@N` 对应选中素材清单第 N 项」。

---

## 4. 工厂与导出

### 4.1 createWebCutAgentPack

[`index.ts`](../src/packs/agent/index.ts)：

```typescript
export interface CreateWebCutAgentPackOptions {
    adapter: WebCutAgentAdapter;        // 必传，由调用方实现
    tools?: WebCutAgentTool[];          // 注入额外工具
    width?: number;                     // 边栏宽度，默认 420
    triggerText?: string;               // 触发按钮文字（旋转 90° 竖排）
}

export function createWebCutAgentPack(options: CreateWebCutAgentPackOptions): new () => WebCutExtensionPack {
    const registry = createToolRegistry(createBuiltinTools(), options.tools);
    class WebCutAgentPack {
        dockConfig = {
            key: 'agent',
            sidebar: Sidebar,
            triggerIcon: AgentIcon,         // 内置 sparkle 图标
            triggerText: triggerText || 'AI Assistant',
            // ...width
        };
        languagePackages = agentLanguagePackages;
        adapter = adapter;
        registry = registry;
    }
    return WebCutAgentPack as unknown as new () => WebCutExtensionPack;
}
```

返回的类直接放进 `<WebCutEditor :packs="[...]">`（dock pack 与其它 ExtensionPack 共用同一个注册入口）。

### 4.2 webcut 顶层导出

[`opensource/webcut/src/index.ts`](../src/index.ts) 新增：

```typescript
export { createWebCutAgentPack } from './packs/agent';
export type { CreateWebCutAgentPackOptions, WebCutAgentPackInstance } from './packs/agent';
export type { WebCutAgentAdapter, WebCutAgentEvent, WebCutAgentStream, WebCutAgentSendParams, WebCutAgentToolSchema } from './packs/agent/adapter';
export type { WebCutAgentTool, WebCutAgentToolRuntime, WebCutAgentToolRegistry } from './packs/agent/tools';
```

> dock 槽位契约复用 `WebCutExtensionPack['dockConfig']`，不再有独立的 `WebCutDockPack` 类型。

---

## 5. 如何使用（消费方接入）

### 5.1 三步接入

以 aiman 为例（参考 [`src/apps/aiman/site/packs/webcut-agent/`](../../../src/apps/aiman/site/packs/webcut-agent/)）。

**第 1 步：实现 adapter**

把 `sendLLMRequest` 嫁接到自家后端 LLM 网关端点，把后端 SSE 事件一对一映射为 `WebCutAgentEvent`。参考 [`adapter.ts`](../../../src/apps/aiman/site/packs/webcut-agent/adapter.ts)：

```typescript
import { httpEventStream } from 'http-lib';
import type { WebCutAgentAdapter, WebCutAgentStream } from '@/opensource/webcut/src';

const EVENT_NAMES = ['reasoning','content','tool_call','usage','end','error', /* ... */];

export function createMyAgentAdapter({ getScopeId }: { getScopeId: () => string }): WebCutAgentAdapter {
    let currentEvt: any = null;
    return {
        sendLLMRequest({ messages, tools, model, enableThinking, extra }) {
            const evt = httpEventStream('/api/v2/my-llm-gateway', {
                scope_id: getScopeId(), messages, tools, model, enable_thinking: enableThinking, ...extra,
            }, true);
            currentEvt = evt;
            const handlers = new Map<string, Set<(e: any) => void>>();
            const deliver = (name: string, data: any) => {
                const e = data && typeof data === 'object' && !Array.isArray(data)
                    ? { type: name, ...data }
                    : { type: name, data };
                handlers.get(name)?.forEach(cb => { try { cb(e); } catch {} });
            };
            EVENT_NAMES.forEach(name => evt.on(name, (data: any) => deliver(name, data)));
            return {
                on(name, cb)  { (handlers.get(name) || handlers.set(name, new Set()).get(name)!).add(cb); return this as WebCutAgentStream; },
                off(name, cb) { handlers.get(name)?.delete(cb); return this as WebCutAgentStream; },
                close()       { try { evt.abort?.(); } catch {} },
            };
        },
        abort() { try { currentEvt?.abort?.(); } catch {} },
    };
}
```

**第 2 步：创建 pack 类**

```typescript
import { createWebCutAgentPack } from '@/opensource/webcut/src';
import { createMyAgentAdapter } from './adapter';

export function createMyAgentPack({ getScopeId }: { getScopeId: () => string }) {
    const adapter = createMyAgentAdapter({ getScopeId });
    // 可选：注入自定义消息渲染器（如 markdown）
    (adapter as any).renderMessage = (msg) => MyMarkdownViewer;
    // 可选：注入额外工具
    return createWebCutAgentPack({
        adapter,
        tools: [/* 自有 WebCutAgentTool[] */],
        width: 420,
        label: 'AI 助手',
    });
}
```

**第 3 步：传给 WebCutEditor**

```vue
<script setup lang="ts">
import { WebCutEditor } from '@/opensource/webcut/src';
import { createMyAgentPack } from '@/packs/webcut-agent';
const MyAgentPack = createMyAgentPack({ getScopeId: () => route.params.episodeId });
</script>

<template>
    <WebCutEditor :packs="[...其它ExtensionPack, MyAgentPack]" />
</template>
```

### 5.2 注入额外工具

按 `WebCutAgentTool` 提供，命名建议非 `webcut.*` 前缀（避免与内置冲突；注入不得覆盖内置同名）：

```typescript
const myTool: WebCutAgentTool = {
    name: 'myapp.append_note',
    description: '给当前镜头追加一条备注',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    async execute(runtime, input) {
        // runtime.ctx 拿响应式剪辑器；runtime.push/remove/seekCursor/updateByAspectRatio 可用
        return { ok: true };
    },
};
createWebCutAgentPack({ adapter, tools: [myTool] });
```

注入工具的 schema 会与内置工具一起，由 pack 在每次 `sendLLMRequest` 时随 messages 发给后端 LLM 端点。

### 5.3 自定义消息渲染

`adapter.renderMessage` 返回一个 Vue 组件（接收 `{ content, message }` props）或 HTML 字符串：

```typescript
(adapter as any).renderMessage = (msg) => MarkdownViewer; // 组件接收 content prop
```

不传则默认按纯文本渲染。

---

## 6. 后端契约（消费方自实现）

webcut 不限定后端实现，但需遵守如下协议，前端 pack 才能正确消费：

### 6.1 请求

```
POST {gateway-url}
{
    "messages": [...],                       // OpenAI 风格，不含 system（system 由后端注入）
    "tools": [{ name, description, parameters }],
    "model": "...",
    "enable_thinking": true,
    ...调用方自定义字段
}
响应：SSE (text/event-stream)
```

### 6.2 SSE 事件（event 名 + JSON data）

| event | data | 说明 |
|---|---|---|
| `reasoning` | `{ "content": "..." }` | 思考链增量 |
| `content` | `{ "content": "..." }` | 正文增量 |
| `tool_call` | `{ "tool": "webcut.add_text_segment", "callId": "...", "input": {...} }` | LLM 决定调用工具（前端执行并自驱下一轮） |
| `usage` | `{ "inputTokens": N, "outputTokens": M }` | 计费用（可选） |
| `error` | 字符串或对象 | 出错 |
| `end` | 任意（触发 `[DONE]` 结束流） | 本轮结束 |

> 后端只透传 LLM 输出，不执行工具、不维护会话。多轮 tool 循环由前端发起多次请求完成。

### 6.3 参考实现

aiman 后端实现了一个完整范例（**消费方参考，不属于 webcut**）：

- 服务：[`src/apps/aiman/server/services/video-cut-agent.service.js`](../../../src/apps/aiman/server/services/video-cut-agent.service.js) — 加载 webcut 的 `system-prompt.md`（mtime 缓存）、流式调用 LLM、透传事件、按 usage 扣费。
- 控制器：[`src/apps/aiman/server/controllers/video-cut-agent.controller.js`](../../../src/apps/aiman/server/controllers/video-cut-agent.controller.js) — 参数校验 + 积分预检。
- 路由：[`src/apps/aiman/server/api/v2/video-cut-agent/chat.js`](../../../src/apps/aiman/server/api/v2/video-cut-agent/chat.js) — `POST`（SSE）/ `DELETE`（中断）。

关键点：system prompt 文件路径按 webcut 模块位置解析（`new URL('../../../../../opensource/webcut/src/packs/agent/prompts/system-prompt.md', import.meta.url)`），mtime 变化时失效重读，保证修改 prompt 即时生效。

---

## 7. 关键文件索引

| 模块 | 文件 |
|---|---|
| Dock 契约 | [`opensource/webcut/src/types/index.ts`](../src/types/index.ts) (`WebCutDockPack`) |
| Dock 注册 | [`opensource/webcut/src/hooks/index.ts`](../src/hooks/index.ts) (`registerDockPack`/`openDock`/`closeDock`/`toggleDock`) |
| Dock 渲染 | [`opensource/webcut/src/views/editor/index.vue`](../src/views/editor/index.vue) |
| Agent 工厂 | [`opensource/webcut/src/packs/agent/index.ts`](../src/packs/agent/index.ts) |
| Adapter 契约 | [`opensource/webcut/src/packs/agent/adapter.ts`](../src/packs/agent/adapter.ts) |
| 工具注册表 | [`opensource/webcut/src/packs/agent/tools.ts`](../src/packs/agent/tools.ts) |
| 内置工具 | [`opensource/webcut/src/packs/agent/tools-builtin.ts`](../src/packs/agent/tools-builtin.ts) |
| Agent 循环 | [`opensource/webcut/src/packs/agent/loop.ts`](../src/packs/agent/loop.ts) |
| Pack store | [`opensource/webcut/src/packs/agent/store.ts`](../src/packs/agent/store.ts) |
| 边栏组件 | [`opensource/webcut/src/packs/agent/components/sidebar.vue`](../src/packs/agent/components/sidebar.vue) |
| 系统提示词 | [`opensource/webcut/src/packs/agent/prompts/system-prompt.md`](../src/packs/agent/prompts/system-prompt.md) |
| 顶层导出 | [`opensource/webcut/src/index.ts`](../src/index.ts) |

---

## 8. 已知约束与扩展点

- **chats 仅内存态**：当前未落 IndexedDB 持久化，刷新页面会丢失；可通过 webcut 的 db 层（`project_state` 维度）扩展。
- **mention / 附件 / 模型选择**：内置 UI 为 MVP 实现（纯文本输入、无附件、模型默认走后端）；消费方可通过 `adapter.renderMessage` / 自定义 sidebar 组件增强。
- **多 dock pack**：当前同一时刻最多展开一个边栏；按钮组天然支持多个 pack 同时注册。
- **错误恢复**：agent 循环单轮失败会写入 assistant.error 并结束；可通过重试策略增强。
- **prompt 路径**：后端按 webcut 模块路径加载 `system-prompt.md`；构建部署需确认该 `.md` 随产物分发（或随 webcut 发布）。

---

## 9. 设计动机：为什么工具循环跑在前端？

剪辑器状态（rails / sources / cursor / 画布尺寸）全部在浏览器内存 + IndexedDB 里，后端无法直接操作。若按传统「后端 agent + tools」模式，需要把每次工具调用的结果在前后端之间反复同步，复杂且易错。

因此本方案把后端退化为**无状态 LLM 网关**：

- 后端不维护会话、不执行工具，只做 LLM 透传 + 计费。
- agent 循环（发请求 → 收 tool_call → 本地执行 → 把结果追加进 messages → 再发请求）跑在前端 pack 内。
- 工具的 schema 与执行器同源（`WebCutAgentTool`），单一信息源，无需向后端单独「上报 schema」。

收益：后端极简、可复用、水平扩展友好；前端获得低延迟的本地工具执行体验；system prompt 随包维护，前后端单一信息源。

---

## 10. 关键架构决策与设计要点

本节记录几个"为什么这样设计"的关键决策，便于后续维护时查阅。

### 10.1 后端 tool 用 awaitSignal 把落地委托给前端：以 generate_video 为例

#### 问题背景

webcut agent 运行时同时存在**两套互不相通的文件存储**：

| | 服务端存储（如 aiman 的 fods） | 浏览器本地存储（OPFS + IndexedDB） |
|---|---|---|
| 谁写入 | 后端 tool（如 `generate_video` 落片 `_file.saveRemoteUrl(url)`） | `library.addNewFile(file)`：写 OPFS + 项目文件表 |
| fileId 形态 | 服务端 ID（fods hash 等） | 文件内容的 MD5（内容寻址） |
| 谁能读 | 后端 / adapter 的 `fetchFile(id)` | webcut 播放器的 `readFile(id)` |

**关键事实**：webcut 播放器的 `push('file:<id>')` **只读浏览器本地 OPFS**。服务端产出的视频 fileId 不在本地 OPFS 中，直接交给 `webcut.add_media_from_library` 会抛 "File not found"，媒体库也不会有这条记录。

#### 解决方案：后端 tool 主动 `createAwaitSignal` + 前端 `onToolCall` 落地

不复用 `add_media_from_library` 这条内置链路（避免污染 webcut 通用层）。改为：

1. **后端 tool 生成完成后返回 awaitSignal**（不是普通结果），通过 `metadata` 携带落地所需信息（file、duration 等）。
2. 内核检测到 awaitSignal → 暂停 agent → SSE 下发 `tool_call_awaiting`（payload 含 `signal`）。
3. 前端 adapter 把事件桥接为 webcut 的 `tool_call_awaiting`，`input = signal.metadata`（arguments 缺失时回退）。
4. webcut loop 的 `executeTool`：该 tool 名不在内置 registry → 走 `adapter.onToolCall(name, meta, context)`。
5. aiman adapter 在 `onToolCall` 里用 **context**（即完整 runtime）完成落地：
   - `fetchSourceAsFile(meta.file)`（adapter 本地 helper，从服务端拉字节为 File）
   - `context.library.addNewFile(file)` → 写本地 OPFS + 项目媒体库 → 得到 localFileId
   - `context.push('video', 'file:' + localFileId)` → 推到时间轴 → 得到 sourceKey
   - 返回 `{ file, sourceKey, duration, ... }`
6. webcut loop 把返回值经 `adapter.resumeWithToolResult` 回后端 → 内核把它作为该 tool 的结果写进消息 → LLM 继续。

**关键**：整条「生成 → 写库 → 推时间轴」是**一次 tool 调用**内完成的，后端不会把一个工具的结果变成对另一个工具的调用；webcut 内置工具保持纯粹（不识别服务端 fileId）；aiman 把自家业务编排放进 adapter 的 `onToolCall` + context。

#### 代码位置

| 角色 | 文件 |
|---|---|
| 后端 tool 返回 awaitSignal | [`src/apps/aiman/server/agent/tools/video/generate-video.tool.js`](../../../src/apps/aiman/server/agent/tools/video/generate-video.tool.js) |
| 内核处理 awaitSignal | [`src/modules/agent/server/v2/core/agent.class.js`](../../../src/modules/agent/server/v2/core/agent.class.js)（`isAwaitSignal` → `pushAwaitSignal` → emit `tool_call_awaiting`） |
| adapter 桥接事件 | [`src/apps/aiman/site/packs/webcut-agent/adapter.ts`](../../../src/apps/aiman/site/packs/webcut-agent/adapter.ts)（`signal.metadata → input`） |
| adapter `onToolCall` 落地 | 同上：`fetchSourceAsFile` + `context.library.addNewFile` + `context.push` |
| webcut loop 兜底 dispatch | [`opensource/webcut/src/packs/agent/loop.ts`](../src/packs/agent/loop.ts)（registry miss → `adapter.onToolCall(name, input, runtime)`） |

#### 为什么不用其他方案

| 候选方案 | 为什么不行 |
|---|---|
| webcut 播放器直接读服务端 fileId | webcut 不能依赖任何后端 |
| 让内置 `add_media_from_library` 自动拉取服务端文件 | 把 aiman 业务污染进 webcut 通用层（已撤销） |
| 服务端直接写客户端 OPFS | 服务端无法访问浏览器本地存储 |
| 后端 LLM 链式调两个工具（generate_video → add_media_from_library） | 把一个工具的结果变成对另一个工具的调用，链路复杂且不优雅 |

### 10.2 `onToolCall` 与剪辑器 runtime

#### 签名

```typescript
// adapter 契约
onToolCall?(funcName: string, funcArgs: any, context: WebCutAgentToolRuntime): Promise<any> | any;
```

`onToolCall` 在 [`loop.ts`](../src/packs/agent/loop.ts) 的 `executeTool` 中作为**非内置 tool 的兜底**调用。`context` 注入完整剪辑器 runtime（与内置 webcut.* 工具的 `execute(runtime, input)` 同源），因此自定义 tool 也能操作剪辑器：

```js
async function executeTool(tc) {
    // 1. 内置工具（webcut.* 注册表）：直接前端执行
    const tool = registry.get(tc.tool);
    if (tool) return await tool.execute(runtime, tc.input || {});

    // 2. 非内置工具：走 adapter.onToolCall，context 传入完整 runtime
    if (adapter.onToolCall) {
        return await adapter.onToolCall(tc.tool, tc.input || {}, runtime);
    }
}
```

#### context 可用能力

完整字段见 [`WebCutAgentToolRuntime`](../src/packs/agent/tools.ts)，常用的：

- `context.ctx`：响应式剪辑器上下文（rails / sources / cursorTime / 画布 / 选中，**可读**）
- `context.push(type, source, meta?)` / `context.pushSeries(...)`：推素材到时间轴
- `context.library.list() / addNewFile(file) / importSource(source)`：读写媒体库
- `context.getSource / findSegment / findRail`：定位素材/轨道
- `context.history.push/undo/redo`、`context.seekCursor / play / pause / setScale` 等

#### 适用场景

- **自定义 tool_call + 需要操作剪辑器**：例如 aiman 的 `generate_video` 服务端生成完成后，LLM 调一个浏览器端 tool 把视频落到时间轴——在 onToolCall 里用 `context.library.importSource(fileId)` 拉到本地、再 `context.push('video', 'file:' + localId)` 落轨。
- **纯后端业务回执**：不操作剪辑器时，context 不用即可。

#### 与内置 webcut.* 工具的取舍

| | 内置 webcut.* 工具（`tools` 选项注入） | adapter.onToolCall |
|---|---|---|
| schema 发给 LLM | ✅ 自动（registry.schemas()） | ❌ 需消费方自行透传给后端 |
| 注册位置 | `tools-builtin/` 或 pack `tools` 选项 | adapter 实现 |
| runtime 访问 | ✅ execute(runtime, input) | ✅ 通过 context 参数 |
| 适合 | 通用、可复用的剪辑器工具 | 与具体后端业务耦合的 tool |

需要操作剪辑器时**两种方式都可行**：通用能力优先内置工具（schema 自动暴露给 LLM）；与具体后端业务耦合、不想暴露 schema 的，走 onToolCall + context。

### 10.3 adapter 契约的双路径（A/B）分发

pack 启动时按 adapter 能力自动选择路径：

- **路径 A（轻量 LLM 网关）**：adapter 只实现 `sendLLMRequest`。后端是无状态透传层，前端自循环 tool 调用（含 `MAX_DEPTH=8` 兜底），chats 走内存。适合无 agent 内核的消费方。
- **路径 B（后端驱动）**：adapter 实现 `sendMessage` + `resumeWithToolResult`。后端持有 LLM 循环；LLM 选中浏览器 tool 时下发 `tool_call_awaiting`，前端执行后 resume。

详见 [`loop.ts`](../src/packs/agent/loop.ts) 的 `send` 实现：检测 `adapter.sendMessage` 是否存在来分发。所有成员均可选；缺省时 pack 用内置兜底（内存 store / 内置渲染 / 内置图标等）。契约不与任何具体后端耦合——adapter 自行解释自家 file/tool/chat 语义。

### 10.4 内置 webcut.* 工具 vs 自定义 tool_call

| | 内置 webcut.* 工具 | adapter.onToolCall |
|---|---|---|
| 注册位置 | `tools-builtin/` 或 pack `tools` 选项 | adapter 实现 |
| runtime 访问 | ✅ execute(runtime, input) | ✅ 通过 context 参数（见 10.2） |
| schema 发给 LLM | ✅ 自动（registry.schemas()） | ❌（需消费方自行透传） |
| 适合 | 通用、可复用的剪辑器工具 | 与具体后端业务耦合的 tool |
| 调用入口 | LLM 调 → `tool_call_awaiting` → registry 命中 → execute | LLM 调 → `tool_call_awaiting` → registry 未命中 → onToolCall 兜底 |

**新增工具时的判断**：通用能力（操作轨道/素材/媒体库/历史）优先内置工具，schema 自动暴露给 LLM；与具体后端业务耦合、不想单独暴露 schema 的，走 onToolCall + context。

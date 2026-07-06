import type { WebCutAgentToolRuntime } from './tools';

/** 附件槽位提交的结构化数据（与选中素材平级，随消息一起发给 LLM）。 */
export interface WebCutAgentAttachment {
    type: string;
    data: any;
}

/** chat 元信息（后端管理 chats 时由 adapter.chats 返回）。 */
export interface WebCutAgentChatMeta {
    id: string;
    title?: string;
    time?: number;
    [k: string]: any;
}

/** 上传到服务端的附件文件对象 */
export interface WebCutAgentUploadedFile {
    fileId: string;          // 服务端文件 id（提交时只发 fileId，不重传文件）
    url?: string;            // 可访问的 URL（预览用）
    type: 'image' | 'video' | 'audio';
    name: string;
    size?: number;
}

/**
 * agent pack 与后端之间的事件协议（前端消费）。
 * - 路径 A（轻量）：后端为无状态 LLM 网关，前端自循环 tool。
 * - 路径 B（后端驱动，如 @fgu/agent）：后端管 LLM 循环；LLM 选中浏览器 tool 时下发 tool_call_awaiting，前端执行后 resume。
 */
export type WebCutAgentEvent =
    | { type: 'message'; data: any }
    | { type: 'warn' | 'error'; data: any }
    | { type: 'reasoning'; content: string }
    | { type: 'completion_start' }
    | { type: 'content'; content: string }
    | { type: 'completion_end' }
    | { type: 'tool_call'; tool: string; callId: string; input: any }
    /** 后端驱动路径：LLM 选中浏览器端 tool，后端暂停等前端执行回传 */
    | { type: 'tool_call_awaiting'; callId: string; tool: string; input: any; signal?: any }
    | { type: 'usage'; data: { inputTokens: number; outputTokens: number } }
    | { type: 'session'; data: { chatId?: string } }
    | { type: 'end' }
    | { type: 'abort' | 'close' | 'http_abort' | 'http_error'; data?: any };

/**
 * agent 事件流。adapter.sendMessage / sendLLMRequest 返回该对象，pack 监听事件消费。
 */
export interface WebCutAgentStream {
    on(name: string, cb: (e: any) => void): this;
    off(name: string, cb: (e: any) => void): this;
    close(): void;
}

/** 工具 schema（喂给 LLM 的工具说明） */
export interface WebCutAgentToolSchema {
    name: string;
    description: string;
    parameters: object;
}

/** 路径 A：轻量 LLM 网关请求参数 */
export interface WebCutAgentSendParams {
    /** OpenAI 风格消息数组（不含 system，system 由后端注入） */
    messages: any[];
    /** 本轮可用工具表 */
    tools?: WebCutAgentToolSchema[];
    model?: string;
    enableThinking?: boolean;
    extra?: Record<string, any>;
}

/** 路径 B：后端驱动 send 参数 */
export interface WebCutAgentSendMessageParams {
    prompt: string;
    attachments?: WebCutAgentAttachment[];
    /** 浏览器端 tool schema（后端转成内核 externalTools） */
    tools?: WebCutAgentToolSchema[];
    enableThinking?: boolean;
    chatId?: string;
}

/**
 * adapter 契约：调用方（如 aiman/site）实现，把 webcut agent pack 接入自己的后端。
 *
 * pack 启动时按能力自动选择运行路径：
 * - **路径 A（轻量 LLM 网关）**：仅实现 `sendLLMRequest`。后端是无状态 LLM 透传层，
 *   前端自循环 tool 调用（含 MAX_DEPTH 兜底），chats 走内存。适合无 agent 内核的消费方。
 * - **路径 B（后端驱动）**：实现 `sendMessage` + `resumeWithToolResult`。后端持有 LLM 循环
 *   （如 @fgu/agent）；LLM 选中浏览器端 tool 时下发 `tool_call_awaiting`，前端执行后 resume。
 *   chats 可由后端持久化（提供 chats 命名空间方法）。
 *
 * 所有成员均为可选；缺省时 pack 用内置兜底（内存 store / 内置渲染 / 内置图标等）。
 * 契约不与任何具体后端耦合——adapter 自行解释自家 file/tool/chat 语义。
 */
export interface WebCutAgentAdapter {
    // —— 路径 A：轻量 LLM 网关 ——

    /**
     * 发起一次 LLM 流式请求（路径 A）。
     * 后端只需做无状态透传：把 messages + tools 转发到底层 LLM 并把 SSE 流回传前端。
     * 前端在收到 tool_call 后自行执行内置 webcut.* 工具，并把结果拼回 messages 再次请求，
     * 直到 LLM 不再调工具或达 MAX_DEPTH。
     *
     * 不实现此方法 → pack 走路径 B。
     */
    sendLLMRequest?(params: WebCutAgentSendParams): WebCutAgentStream;

    // —— 路径 B：后端驱动（@fgu/agent 等）——

    /**
     * 把用户消息交给后端 agent 内核驱动一轮（路径 B）。
     * `tools` 是浏览器端 tool 的 schema（前端始终用 tools 命名），后端转成自家内核语义
     * （如 @fgu/agent 的 externalTools）。后端 LLM 选中浏览器 tool 时，stream 会以
     * `tool_call_awaiting` 事件结束，pack 本地执行后调 `resumeWithToolResult` 继续。
     *
     * 不实现此方法 → pack 走路径 A。
     */
    sendMessage?(params: WebCutAgentSendMessageParams): WebCutAgentStream;

    /**
     * 把浏览器端 tool 的执行结果回传后端，触发 agent resume（路径 B）。
     * 返回新一轮事件流，pack 继续消费直到下一轮 `tool_call_awaiting` 或 `end`。
     * `error` 非空时把工具错误作为结果交给后端 LLM，由其决定后续动作。
     */
    resumeWithToolResult?(payload: { callId: string; result: any; error?: string; chatId?: string }): WebCutAgentStream;

    /**
     * 中断当前正在进行的流（两路径通用）。用户主动停止 / 切换 chat 时调用。
     */
    abort?(): void;

    // —— chats（可选；不提供则 pack 用内存 store，刷新即丢）——

    /**
     * 列出当前 scope 下的所有 chat（按时间倒序）。后端持久化时由 adapter 实现；
     * 不实现则 pack 用内存数组。
     */
    listChats?(): Promise<WebCutAgentChatMeta[]>;

    /** 新建一个空 chat，返回其元信息（含分配的 id）。 */
    createChat?(): Promise<WebCutAgentChatMeta>;

    /** 删除指定 chat（含其消息）。后端应级联清理。 */
    deleteChat?(chatId: string): Promise<void>;

    /**
     * 切换当前激活 chat（后端可记录上次活跃，便于跨设备恢复）。
     * 不需要此能力时由 pack 在前端维护当前 chatId 即可。
     */
    switchChat?(chatId: string): Promise<void>;

    /**
     * 拉取指定 chat 的历史消息（用于打开旧 chat 时回填消息列表）。
     * pack 会把返回值与后续 SSE 增量合并。
     */
    getChatMessages?(chatId: string): Promise<any[]>;

    // —— 渲染（可选）——

    /**
     * 自定义消息气泡渲染。返回 Vue 组件 → pack 用 <component :is> 挂载；
     * 返回 string → 作为 HTML 注入（v-html）；返回 falsy → pack 退化为纯文本。
     * 用于让消费方注入自家 markdown / 富文本渲染器。
     */
    renderMessage?(msg: any): any;

    /**
     * 自定义 mention chip 内缩略图/图标渲染（可选）。
     * 接收 segment 数据，返回一个 HTMLElement 作为 chip 内的 icon 区域；不提供时用内置 SVG icon。
     * 第二个参数 openPreviewModal：在元素上绑定 click 即可打开 pack 内置的素材预览弹窗
     * （图片/视频/音频），无需消费方自备预览组件。
     */
    renderMentionSegment?(seg: {
        name: string;
        type?: string;
        sourceKey?: string;
        url?: string;
        external?: boolean;
        mediaType?: 'image' | 'audio' | 'video';
        fileId?: string;
    }, openPreviewModal?: (item: { type: 'image' | 'video' | 'audio'; url: string; name?: string }) => void): HTMLElement;

    // —— 文件（可选）——

    /**
     * 上传文件到服务端，返回服务端文件对象。
     * 仅在 pack 启用了附件上传（supportsUploadAttachments）时被调用。
     * 返回的 fileId 会以 `<user-uploads>` 块随消息提交给 LLM；url 用于前端预览。
     */
    uploadFile?(file: File): Promise<WebCutAgentUploadedFile>;

    // —— 自定义 tool_call（可选）——

    /**
     * 自定义 tool_call 处理（可选）。
     * 当 LLM 返回的 tool_call 不在内置 webcut.* 工具注册表中时，走此回调。
     * 调用方（如 aiman）可在此结合后端逻辑处理自己的 tool call（如 generate_video 等）。
     * 返回值作为 tool 执行结果回传给 LLM 继续对话。
     *
     * context 注入完整剪辑器 runtime（与内置 webcut.* 工具的 execute(runtime, input) 同源）：
     * - `context.ctx`：响应式剪辑器上下文（rails / sources / cursorTime / 画布 / 选中 等，可读）
     * - `context.push(type, source, meta?)`：推素材到时间轴
     * - `context.library.list() / addNewFile(file) / importSource(source)`：读写媒体库
     * - `context.getSource / findSegment / findRail`：定位素材/轨道
     * - `context.history.push/undo/redo`、`context.seekCursor / play / pause` 等
     * 完整字段见 `WebCutAgentToolRuntime`（tools.ts）。
     *
     * 例：自定义 `aiman.add_generated_video` tool 在生成完成后用 context.push 把视频落到时间轴。
     */
    onToolCall?(funcName: string, funcArgs: any, context: WebCutAgentToolRuntime): Promise<any> | any;
}

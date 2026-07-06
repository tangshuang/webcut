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
    | { type: 'tool_call_awaiting'; callId: string; tool: string; input: any }
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
 * adapter 契约：调用方（如 aiman/site）实现。两条路径按能力分发：
 * - 仅实现 sendLLMRequest → 路径 A（前端自循环）。
 * - 实现 sendMessage + resumeWithToolResult → 路径 B（后端驱动）。
 * 所有成员除注释外均为可选；chats 不提供时 pack 用内存 store。
 */
export interface WebCutAgentAdapter {
    // —— 路径 A：轻量 LLM 网关 ——
    sendLLMRequest?(params: WebCutAgentSendParams): WebCutAgentStream;

    // —— 路径 B：后端驱动（@fgu/agent 等）——
    sendMessage?(params: WebCutAgentSendMessageParams): WebCutAgentStream;
    /** 浏览器 tool 执行结果回传，触发后端 resume（返回新的事件流） */
    resumeWithToolResult?(payload: { callId: string; result: any; error?: string; chatId?: string }): WebCutAgentStream;

    /** 中断当前流（两路径通用） */
    abort?(): void;

    // —— chats（可选；不提供则 pack 用内存 store。平铺在顶层，调用方直接传入）——
    listChats?(): Promise<WebCutAgentChatMeta[]>;
    createChat?(): Promise<WebCutAgentChatMeta>;
    deleteChat?(chatId: string): Promise<void>;
    switchChat?(chatId: string): Promise<void>;
    getChatMessages?(chatId: string): Promise<any[]>;

    // —— 渲染/文件（可选）——
    listModels?(): Promise<any[]>;
    renderMessage?: (msg: any) => any;
    fileUrl?: (file: string) => string;

    /**
     * 自定义 mention chip 内缩略图/图标渲染（可选）。
     * 接收 segment 数据，返回一个 HTMLElement 作为 chip 内的 icon 区域。
     * 不提供时用内置 SVG icon。
     * openPreviewModal：传入后可在元素上绑定 click 打开内置预览弹窗。
     */
    renderMentionSegment?(seg: { name: string; type?: string; sourceKey?: string; url?: string; external?: boolean; mediaType?: 'image' | 'audio' | 'video'; fileId?: string }, openPreviewModal?: (item: { type: 'image' | 'video' | 'audio'; url: string; name?: string }) => void): HTMLElement;

    // —— 附件上传（可选；支持图片/视频/音频）——
    /** 上传文件到服务端，返回服务端文件对象（fileId 用于后续引用与提交） */
    uploadFile?(file: File): Promise<WebCutAgentUploadedFile>;

    /**
     * 自定义 tool_call 处理（可选）。
     * 当 LLM 返回的 tool_call 不在内置 webcut.* 工具注册表中时，走此回调。
     * 调用方（如 aiman）可在此结合后端逻辑处理自己的 tool call（如 generate_video 等）。
     * 返回值作为 tool 执行结果回传给 LLM 继续对话。
     */
    onToolCall?(funcName: string, funcArgs: any, context: any): Promise<any> | any;
}

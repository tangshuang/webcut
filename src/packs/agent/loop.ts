import type { WebCutAgentAdapter, WebCutAgentStream, WebCutAgentAttachment } from './adapter';
import type { WebCutAgentToolRegistry, WebCutAgentToolRuntime } from './tools';
import type { AgentMessage, WebCutAgentStore } from './store';
import { createMessageId } from './store';
import { buildContextSnapshot, formatContextMessage } from './context-snapshot';

const STREAM_EVENTS = [
    'message', 'warn', 'error', 'session',
    'reasoning', 'completion_start', 'content', 'completion_end',
    'tool_call', 'tool_call_awaiting', 'usage',
    'end', 'abort', 'close', 'http_abort', 'http_error',
] as const;

/** 单轮上限（路径 A 防死循环；路径 B 由后端 maxDepth 管控，前端仅兜底） */
const MAX_DEPTH = 8;

export interface AgentLoop {
    send(prompt: string, extra?: { attachments?: WebCutAgentAttachment[] }): Promise<void>;
    abort(): void;
}

/**
 * 前端 agent 循环。双路径按 adapter 能力分发：
 * - 路径 A（adapter 仅提供 sendLLMRequest）：前端自循环，本地执行 tool，MAX_DEPTH 兜底。
 * - 路径 B（adapter 提供 sendMessage + resumeWithToolResult）：后端驱动；收到 tool_call_awaiting 本地执行 tool 后 resume。
 *
 * store 由 sidebar 显式传入（避免 provide/inject 同实例问题）。
 */
export function createAgentLoop(options: {
    adapter: WebCutAgentAdapter;
    registry: WebCutAgentToolRegistry;
    runtime: WebCutAgentToolRuntime;
    store: WebCutAgentStore;
}): AgentLoop {
    const { adapter, registry, runtime, store } = options;
    let currentStream: WebCutAgentStream | null = null;
    let aborted = false;

    function abort() {
        aborted = true;
        try { adapter.abort?.(); } catch {}
        try { currentStream?.close(); } catch {}
    }

    async function send(prompt: string, extra?: { attachments?: WebCutAgentAttachment[] }) {
        if (store.isRuning.value) return;
        const chat = store.currentChat.value;
        if (!chat) return;
        store.isRuning.value = true;
        aborted = false;
        if (!chat.title) chat.title = prompt.slice(0, 24);
        chat.messages.push({ id: createMessageId(), role: 'user', content: prompt });

        try {
            if (adapter.sendMessage && adapter.resumeWithToolResult) {
                await runBackendDriven(prompt, extra?.attachments);
            } else if (adapter.sendLLMRequest) {
                await runLocalLoop();
            } else {
                throw new Error('adapter 必须提供 sendLLMRequest（路径 A）或 sendMessage + resumeWithToolResult（路径 B）');
            }
        } finally {
            store.isThinking.value = false;
            store.isRuning.value = false;
            currentStream = null;
            try { await runtime.history.push({ title: prompt.slice(0, 40) || 'agent operation' }); } catch {}
        }
    }

    // —— 路径 A：前端自循环（原有）——
    async function runLocalLoop() {
        const chat = store.currentChat.value;
        let injectedThisTurn = false;
        let depth = 0;
        while (depth < MAX_DEPTH) {
            const assistant: AgentMessage = { id: createMessageId(), role: 'assistant', content: '', reasoning: '', tool_calls: [], pending: true };
            const requestMessages = buildRequestMessages(chat!.messages);
            if (!injectedThisTurn) {
                try {
                    const snapshot = buildContextSnapshot(runtime);
                    requestMessages.unshift({ role: 'system', content: formatContextMessage(snapshot) });
                } catch {}
                injectedThisTurn = true;
            }
            chat!.messages.push(assistant);
            const toolCalls = await consumeLocalStream(() => adapter.sendLLMRequest!({
                messages: requestMessages,
                tools: registry.schemas(),
                model: store.model.value || undefined,
                enableThinking: store.enableThinking.value,
            }), assistant);
            if (aborted || !toolCalls.length) break;
            for (const tc of toolCalls) {
                if (aborted) break;
                await executeToolAndAppend(tc);
            }
            depth++;
        }
    }

    /** 路径 A：消费一次 LLM 流，累积到 assistant 消息，返回待执行 tool 调用列表 */
    function consumeLocalStream(open: () => WebCutAgentStream, assistant: AgentMessage): Promise<{ tool: string; callId: string; input: any }[]> {
        const toolCalls: { tool: string; callId: string; input: any }[] = [];
        return new Promise((resolve) => {
            const stream = open();
            currentStream = stream;
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                for (const n of STREAM_EVENTS) stream.off(n as string, onEvent);
                assistant.pending = false;
                store.isThinking.value = false;
                resolve(toolCalls);
            };
            const onEvent = (e: any) => {
                if (settled) return;
                switch (e?.type) {
                    case 'reasoning': assistant.reasoning = (assistant.reasoning || '') + (e.content || ''); store.isThinking.value = true; break;
                    case 'content': assistant.content += e.content || ''; break;
                    case 'tool_call': toolCalls.push({ tool: e.tool, callId: e.callId, input: e.input }); assistant.tool_calls = assistant.tool_calls || []; assistant.tool_calls.push({ tool: e.tool, callId: e.callId, input: e.input }); break;
                    case 'error': assistant.error = typeof e.data === 'string' ? e.data : JSON.stringify(e.data); break;
                    case 'end': case 'abort': case 'close': case 'http_abort': case 'http_error': finish(); break;
                }
            };
            for (const n of STREAM_EVENTS) stream.on(n as string, onEvent);
            setTimeout(finish, 120000);
        });
    }

    // —— 路径 B：后端驱动（@fgu/agent 等）——
    async function runBackendDriven(prompt: string, attachments?: WebCutAgentAttachment[]) {
        const chat = store.currentChat.value;
        // 首轮把剪辑器快照作为 attachment 一并提交，后端写入 context
        const snapshotAttachment: WebCutAgentAttachment | null = (() => {
            try { return { type: 'webcut_context', data: buildContextSnapshot(runtime) }; }
            catch { return null; }
        })();
        const allAttachments = [...(attachments || []), ...(snapshotAttachment ? [snapshotAttachment] : [])];

        // 每轮 stream 独立创建 assistant 消息，保证 content / tool / 下一轮 content 按时间顺序排列
        let assistant: AgentMessage = { id: createMessageId(), role: 'assistant', content: '', reasoning: '', tool_calls: [], pending: true };
        chat!.messages.push(assistant);

        // 首次 send
        let pending: { callId: string; tool: string; input: any } | null = null;
        pending = await consumeBackendStream(() => adapter.sendMessage!({
            prompt, attachments: allAttachments, tools: registry.schemas(),
            enableThinking: store.enableThinking.value, chatId: store.currentChatId.value,
        }), assistant);

        // 循环：执行 browser tool → resume → 新 stream（新 assistant 消息）
        let depth = 0;
        while (pending && depth < MAX_DEPTH) {
            if (aborted) break;
            // 本地执行 tool，先 push 一条 tool 消息占位
            const toolMsg: AgentMessage = { id: createMessageId(), role: 'tool', content: '', tool_call_id: pending.callId, name: pending.tool, pending: true };
            chat!.messages.push(toolMsg);
            let result: any;
            try { result = await executeTool(pending); }
            catch (err) { result = { error: String(err) }; }
            toolMsg.content = safeStringify(result);
            toolMsg.pending = false;

            // 当前 assistant 已结束，resume 起新 stream → 新 assistant 消息承接后续 content
            assistant.pending = false;
            const nextAssistant: AgentMessage = { id: createMessageId(), role: 'assistant', content: '', reasoning: '', tool_calls: [], pending: true };
            chat!.messages.push(nextAssistant);

            const next = pending;
            pending = await consumeBackendStream(() => adapter.resumeWithToolResult!({
                callId: next.callId, result, chatId: store.currentChatId.value,
            }), nextAssistant);
            assistant = nextAssistant;
            depth++;
        }
        assistant.pending = false;
    }

    /** 路径 B：消费一次后端 stream；若以 tool_call_awaiting 结束，返回待执行 tool 描述 */
    function consumeBackendStream(open: () => WebCutAgentStream, assistant: AgentMessage): Promise<{ callId: string; tool: string; input: any } | null> {
        return new Promise((resolve) => {
            const stream = open();
            currentStream = stream;
            let pending: { callId: string; tool: string; input: any } | null = null;
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                for (const n of STREAM_EVENTS) stream.off(n as string, onEvent);
                store.isThinking.value = false;
                resolve(pending);
            };
            const onEvent = (e: any) => {
                if (settled) return;
                switch (e?.type) {
                    case 'session': if (e.data?.chatId && e.data.chatId !== store.currentChatId.value) store.adoptChatId(e.data.chatId); break;
                    case 'reasoning': assistant.reasoning = (assistant.reasoning || '') + (e.content || ''); store.isThinking.value = true; break;
                    case 'content': assistant.content += e.content || ''; break;
                    case 'tool_call_awaiting':
                        pending = { callId: e.callId, tool: e.tool, input: e.input };
                        // 记录到当前 assistant 的 tool_calls，让 UI 可展示工具名与入参
                        assistant.tool_calls = assistant.tool_calls || [];
                        assistant.tool_calls.push({ tool: e.tool, callId: e.callId, input: e.input });
                        break;
                    case 'error': assistant.error = typeof e.data === 'string' ? e.data : JSON.stringify(e.data); break;
                    case 'end': case 'abort': case 'close': case 'http_abort': case 'http_error': finish(); break;
                }
            };
            for (const n of STREAM_EVENTS) stream.on(n as string, onEvent);
            setTimeout(finish, 720000); // 后端 agent 单轮可能较长（视频生成轮询最长 ~10min），12min 兜底
        });
    }

    // —— 共用：本地执行 tool ——
    async function executeToolAndAppend(tc: { tool: string; callId: string; input: any }) {
        const chat = store.currentChat.value;
        const result = await executeTool(tc);
        chat!.messages.push({ id: createMessageId(), role: 'tool', content: safeStringify(result), tool_call_id: tc.callId, name: tc.tool });
    }

    async function executeTool(tc: { tool: string; callId: string; input: any }): Promise<any> {
        // 1. 内置工具（webcut.* 注册表）：直接前端执行
        const tool = registry.get(tc.tool);
        if (tool) return await tool.execute(runtime, tc.input || {});
        // 2. 非内置工具：走 adapter.onToolCall（调用方结合后端逻辑处理自定义 tool call）
        //    context 传入完整 runtime，使自定义 tool 也能 push 到时间轴 / 写媒体库等
        if (adapter.onToolCall) {
            try {
                return await adapter.onToolCall(tc.tool, tc.input || {}, runtime);
            } catch (err) {
                return { error: String(err) };
            }
        }
        return { error: `工具 ${tc.tool} 不存在且 adapter 未提供 onToolCall` };
    }

    return { send, abort };
}

/** 把 store 消息序列转成发给后端的 OpenAI 风格 messages（路径 A 用，不含 system） */
export function buildRequestMessages(msgs: AgentMessage[]): any[] {
    const out: any[] = [];
    for (const m of msgs) {
        if (m.role === 'user') {
            out.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
            const item: any = { role: 'assistant', content: m.content || '' };
            if (m.tool_calls && m.tool_calls.length) {
                item.tool_calls = m.tool_calls.map((tc) => ({ id: tc.callId, type: 'function', function: { name: tc.tool, arguments: JSON.stringify(tc.input ?? {}) } }));
            }
            out.push(item);
        } else if (m.role === 'tool') {
            out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: m.content });
        }
    }
    return out;
}

function safeStringify(v: any): string {
    if (v === undefined) return '{}';
    try { return typeof v === 'string' ? v : JSON.stringify(v); }
    catch { return String(v); }
}

import { inject, provide, reactive, ref, computed, watch, type InjectionKey, type Ref, type ComputedRef } from 'vue';
import type { WebCutAgentAdapter, WebCutAgentChatMeta } from './adapter';

/** agent 对话消息。结构贴近 OpenAI 风格，便于直接作为 LLM 请求的 messages。 */
export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    reasoning?: string;
    tool_calls?: { tool: string; callId: string; input: any }[];
    tool_call_id?: string;
    name?: string;
    pending?: boolean;
    error?: string;
}

export interface AgentChat {
    id: string;
    title: string;
    messages: AgentMessage[];
    createdAt: number;
}

export interface WebCutAgentStore {
    chats: Ref<AgentChat[]>;
    currentChatId: Ref<string>;
    isThinking: Ref<boolean>;
    isRuning: Ref<boolean>;
    enableThinking: Ref<boolean>;
    model: Ref<string>;
    ready: Ref<boolean>;
    currentChat: ComputedRef<AgentChat>;
    messages: ComputedRef<AgentMessage[]>;
    init(): Promise<void>;
    createChat(): Promise<string>;
    deleteChat(id: string): Promise<void>;
    switchChat(id: string): Promise<void>;
    /** 仅认领 chatId（后端 session 事件用）：upsert + 设当前 + 持久化，不调 switchChat、不重载消息，避免冲掉流式累积 */
    adoptChatId(id: string): void;
    /** 后端驱动模式下写入/读取 active chatId 到 localStorage（按 scope 隔离） */
    persistActiveChatId(id: string | null): void;
    readActiveChatId(): string | null;
    reset(): void;
}

const STORE_KEY: InjectionKey<WebCutAgentStore> = Symbol('WEBCUT_AGENT_STORE');

/** 重新 provide 已存在的 store（缓存复用场景，需在当前组件实例重新 provide 子组件才能注入） */
export function provideWebCutAgentStore(store: WebCutAgentStore) {
    provide(STORE_KEY, store);
}

/** pack 实例注入键（共享），供子组件取 adapter.renderMessage 等 */
export const AGENT_PACK_KEY: InjectionKey<any> = Symbol.for('WEBCUT_AGENT_PACK');

/** runtime 注入键，供子组件（messages-view/init）读 ctx.selected、调用 unselectSegment 等 */
export const AGENT_RUNTIME_KEY: InjectionKey<any> = Symbol.for('WEBCUT_AGENT_RUNTIME');

function rid(): string {
    return 'm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
export { rid as createMessageId };

/** 把后端 agent 消息（OpenAI 风格）映射为内部 AgentMessage */
function mapBackendMessage(m: any): AgentMessage {
    if (!m || typeof m !== 'object') return { id: rid(), role: 'user', content: String(m ?? '') };
    const role = (m.role === 'assistant' || m.role === 'tool') ? m.role : 'user';
    const out: AgentMessage = {
        id: m.id || rid(),
        role,
        content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || JSON.stringify(m.content || '')),
    };
    if (role === 'assistant') {
        if (m.reasoning_content) out.reasoning = m.reasoning_content;
        if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
            out.tool_calls = m.tool_calls.map((tc: any) => ({
                tool: tc.function?.name || tc.name || tc.tool || '',
                callId: tc.id || tc.callId || '',
                input: (() => { try { return typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.input ?? tc.arguments ?? {}); } catch { return {}; } })(),
            })).filter((x: any) => x.tool);
        }
    } else if (role === 'tool') {
        out.tool_call_id = m.tool_call_id || m.toolCallId;
        out.name = m.name;
    }
    return out;
}

/**
 * 创建 agent store。
 * - 提供 adapter.chats → 后端驱动模式：list/create/delete/switch/getMessages 全走 adapter，
 *   active chatId 持久化到 localStorage（按 scopeId 隔离，参考 aiman plot-creation 范式）。
 * - 不提供 → 内存模式（原行为）。
 *
 * aiman 侧只需在 adapter.chats 实现这 5 个方法（调 /api/v2/agents/video/chats 系列），pack 自动启用后端模式。
 */
export function createWebCutAgentStore(opts: { adapter?: WebCutAgentAdapter; getScopeId?: () => string } = {}): WebCutAgentStore {
    const { adapter, getScopeId } = opts;
    const hasChats = !!(adapter?.listChats && adapter?.createChat && adapter?.deleteChat && adapter?.switchChat && adapter?.getChatMessages);
    const persistenceKey = () => `webcut-agent:active-chat:${getScopeId?.() || 'default'}`;

    const newChat = (id: string, title = '', messages: AgentMessage[] = []): AgentChat => ({ id, title, messages, createdAt: Date.now() });

    const chats = ref<AgentChat[]>([]);
    const currentChatId = ref<string>('');
    const isThinking = ref(false);
    const isRuning = ref(false);
    const enableThinking = ref((() => { try { return localStorage.getItem('webcut-agent:enable-thinking') === '1'; } catch { return false; } })());
    watch(enableThinking, (v) => { try { localStorage.setItem('webcut-agent:enable-thinking', v ? '1' : '0'); } catch {} });
    const model = ref<string>('');
    const ready = ref(false);

    // 内存模式兜底：保证总有一个 chat
    if (!hasChats) {
        const c = newChat('c_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
        chats.value = [c];
        currentChatId.value = c.id;
        ready.value = true;
    }

    const currentChat = computed(() => chats.value.find((c) => c.id === currentChatId.value) || chats.value[0] || null);
    const messages = computed(() => currentChat.value?.messages || []);

    function persistActiveChatId(id: string | null) {
        try {
            if (id) localStorage.setItem(persistenceKey(), id);
            else localStorage.removeItem(persistenceKey());
        } catch {}
    }
    function readActiveChatId(): string | null {
        try { return localStorage.getItem(persistenceKey()); } catch { return null; }
    }

    /** 后端模式：拉取某 chat 的历史消息并填入 chats 列表对应项 */
    async function loadMessages(chatId: string) {
        if (!hasChats) return;
        try {
            const raw = await adapter!.getChatMessages!(chatId);
            const list: AgentMessage[] = (Array.isArray(raw) ? raw : []).map(mapBackendMessage);
            const chat = chats.value.find((c) => c.id === chatId);
            if (chat) chat.messages = list;
        } catch {}
    }

    async function init() {
        if (!hasChats) { ready.value = true; return; }
        try {
            const list = await adapter!.listChats!();
            chats.value = (list || []).map((c: WebCutAgentChatMeta) => newChat(c.id, c.title || '', []));
            // 选定初始 chat：localStorage 持久化的 > 列表第一个 > 新建
            const persisted = readActiveChatId();
            let target = (persisted && chats.value.some((c) => c.id === persisted)) ? persisted : (chats.value[0]?.id || '');
            if (!target) {
                const created = await adapter!.createChat!();
                chats.value.unshift(newChat(created.id, created.title || ''));
                target = created.id;
            }
            await switchChat(target);
        } catch {
            // 后端异常兜底：建一个本地空 chat，避免 UI 卡死
            if (!chats.value.length) {
                const c = newChat('local_' + Math.random().toString(36).slice(2));
                chats.value = [c];
                currentChatId.value = c.id;
            }
        } finally {
            ready.value = true;
        }
    }

    async function createChat(): Promise<string> {
        if (!hasChats) {
            const c = newChat('c_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
            chats.value.unshift(c);
            currentChatId.value = c.id;
            return c.id;
        }
        const created = await adapter!.createChat!();
        chats.value.unshift(newChat(created.id, created.title || ''));
        await switchChat(created.id);
        return created.id;
    }

    async function deleteChat(id: string): Promise<void> {
        const idx = chats.value.findIndex((c) => c.id === id);
        if (idx === -1) return;
        if (hasChats) {
            try { await adapter!.deleteChat!(id); } catch {}
        }
        chats.value.splice(idx, 1);
        if (currentChatId.value === id) {
            if (hasChats && chats.value.length) {
                await switchChat(chats.value[0].id);
            } else if (chats.value.length) {
                currentChatId.value = chats.value[0].id;
            } else if (hasChats) {
                await createChat();
            } else {
                const c = newChat('c_' + Math.random().toString(36).slice(2));
                chats.value = [c];
                currentChatId.value = c.id;
            }
        }
        if (readActiveChatId() === id) persistActiveChatId(null);
    }

    async function switchChat(id: string): Promise<void> {
        if (!id) return;
        if (!chats.value.some((c) => c.id === id)) {
            chats.value.unshift(newChat(id, '', []));
        }
        currentChatId.value = id;
        if (hasChats) {
            persistActiveChatId(id);
            try { await adapter!.switchChat!(id); } catch {}
            await loadMessages(id);
        }
    }

    function adoptChatId(id: string) {
        if (!id) return;
        if (!chats.value.some((c) => c.id === id)) {
            chats.value.unshift(newChat(id, '', []));
        }
        currentChatId.value = id;
        if (hasChats) persistActiveChatId(id);
    }

    function reset() {
        const chat = currentChat.value;
        if (chat) { chat.messages = []; chat.title = ''; }
    }

    const store: WebCutAgentStore = {
        chats, currentChatId, isThinking, isRuning, enableThinking, model, ready,
        currentChat, messages,
        init, createChat, deleteChat, switchChat, adoptChatId,
        persistActiveChatId, readActiveChatId, reset,
    };
    provide(STORE_KEY, store);
    return store;
}

export function useWebCutAgentStore(): WebCutAgentStore {
    const store = inject(STORE_KEY);
    if (!store) {
        throw new Error('useWebCutAgentStore must be used inside an agent sidebar component');
    }
    return store;
}

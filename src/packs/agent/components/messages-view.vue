<script setup lang="ts">
import { computed, inject, nextTick, ref, watch, type Component } from 'vue';
import { useT } from '../../../i18n/hooks';
import { useWebCutAgentStore, AGENT_PACK_KEY, AGENT_RUNTIME_KEY, type AgentMessage } from '../store';
import { toolShortName, toolNameI18nKey } from '../tool-names';
import type { WebCutAgentAttachment } from '../adapter';
import { useSelectionMention } from '../composables/use-selection-mention';
import { useAttachments } from '../composables/use-attachments';
import ThinkingText from './thinking-text.vue';
import MarkdownView from './markdown-view.vue';
import MentionInput from './mention-input.vue';
import ClipsBar from './clips-bar.vue';
import FilePreviewModal from './file-preview-modal.vue';
import type { ClipItem } from '../clip-types';

const t = useT();
const store = useWebCutAgentStore();
const { enableThinking } = store;
const emit = defineEmits<{ (e: 'send', prompt: string, attachments?: WebCutAgentAttachment[]): void; (e: 'abort'): void }>();

// 注入 pack 实例，用于可选的自定义消息渲染（adapter.renderMessage）+ 附件槽位
const pack = inject<any>(AGENT_PACK_KEY, null);
const runtime = inject<any>(AGENT_RUNTIME_KEY, null);
const renderMessage = pack?.adapter?.renderMessage as undefined | ((msg: AgentMessage) => Component | string);
const operationSlots: Component[] = pack?.operationSlots || [];

const scroller = ref<HTMLElement | null>(null);
const text = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const mentionInputRef = ref<any>(null);
const previewState = ref<null | { type: 'image' | 'video' | 'audio'; url: string; name?: string }>(null);

// 附件槽位提交数据（按 type 去重 upsert）
const attachments = ref<WebCutAgentAttachment[]>([]);
function onSlotAttach(payload: WebCutAgentAttachment) {
    if (!payload || !payload.type) return;
    const idx = attachments.value.findIndex((a) => a.type === payload.type);
    if (idx >= 0) attachments.value[idx] = payload;
    else attachments.value.push(payload);
}

// 选中素材（作为 MentionInput 的候选 + clip 移除）
const { selectedMaterials, removeMaterial, buildSubmitText } = useSelectionMention(runtime, text);

// 上传附件
const { uploadedFiles, upload, removeUpload } = useAttachments(pack?.adapter);

/** 统一 clip 列表：编辑器选中素材（@N 序号）+ 上传附件（@name 格式，index=0） */
const clipItems = computed<ClipItem[]>(() => {
    let idx = 0;
    const items: ClipItem[] = [];
    for (const m of selectedMaterials.value) {
        idx++;
        items.push({ key: m.sourceKey || `sel_${idx}`, index: idx, name: m.text || m.name, type: m.type, url: undefined, currentSelectedSegment: m.currentSelectedSegment });
    }
    for (const f of uploadedFiles.value) {
        items.push({ key: f.fileId, index: 0, name: f.name, type: f.type, url: f.url });
    }
    return items;
});

/** 统一 MentionInput 候选项（编辑器素材带序号 @N，上传文件 external=true 用 @name） */
const allCandidates = computed(() => clipItems.value.map((c) => ({ index: c.index, name: c.name, type: c.type, sourceKey: c.key, url: c.url, external: c.index === 0 })));

function onClipDelete(key: string) {
    // 先记住被删项的旧序号
    const clip = clipItems.value.find((c) => c.key === key);
    const oldIndex = clip?.index;
    // 执行删除
    const material = selectedMaterials.value.find((m) => (m.sourceKey || '') === key);
    if (material) { removeMaterial(material); }
    else { removeUpload(key); }
    // 同步输入框：移除 @oldIndex + 后续 @M 全部 -1
    if (oldIndex != null) {
        const re = /@(\d+)/g;
        let result = '';
        let last = 0;
        let m;
        while ((m = re.exec(text.value)) !== null) {
            result += text.value.slice(last, m.index);
            const n = Number(m[1]);
            if (n !== oldIndex) result += (n > oldIndex ? `@${n - 1}` : m[0]);
            last = m.index + m[0].length;
        }
        result += text.value.slice(last);
        text.value = result;
    }
}
function onClipPreview(item: ClipItem) {
    const file = uploadedFiles.value.find((f) => f.fileId === item.key);
    if (file && file.url) { previewState.value = { type: file.type, url: file.url, name: file.name }; }
    // 选中素材暂不预览（可后续扩展）
}

function triggerUpload() { fileInputRef.value?.click(); }
async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    for (const file of Array.from(input.files)) {
        await upload(file);
    }
    input.value = '';
}

const list = computed(() => store.messages.value);

/** 向前遍历，从最近一条 assistant 消息的 tool_calls 中找到当前 tool 消息对应的工具名 + 入参。
 *  工具名取自 assistant.tool_calls（比 tool 消息的 metadata 更可靠）。 */
function findToolCall(arr: AgentMessage[], idx: number): { tool: string; input: any; raw?: string } | null {
    const m = arr[idx];
    if (m.role !== 'tool' || !m.tool_call_id) return null;
    for (let j = idx - 1; j >= 0; j--) {
        const prev = arr[j];
        if (prev.role === 'assistant' && prev.tool_calls) {
            const hit = prev.tool_calls.find((tc) => tc.callId === m.tool_call_id);
            if (hit) return { tool: hit.tool, input: hit.input, raw: hit.raw };
        }
    }
    return null;
}

/** 展示用列表：
 *  - 规范化 content/reasoning，过滤空 assistant 消息；
 *  - tool 消息按 tool_call_id 去重（后端会发 await 占位 + 结果两条），合并入参（找不到入参则忽略）；
 *  - 工具名优先取 assistant.tool_calls 中的，兜底 metadata。 */
const visibleList = computed(() => {
    const out: (AgentMessage & { tool_input?: string })[] = [];
    const arr = list.value;
    const toolIndex = new Map<string, number>(); // tool_call_id -> out 下标
    for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        const content = displayContent(m);
        const reasoning = m.reasoning ? normalizeContent(m.reasoning) : '';

        if (m.role === 'tool') {
            const callId = m.tool_call_id || '';
            const existing = callId ? toolIndex.get(callId) : undefined;
            // 同 callId 已展示过：仅当当前是结果（有 content）时更新，否则跳过（占位已被结果覆盖）
            if (existing != null) {
                if (content) {
                    const tc = findToolCall(arr, i);
                    out[existing] = {
                        ...out[existing],
                        content,
                        tool_input: tc ? toolInputToString(tc) : out[existing].tool_input,
                        name: tc?.tool || out[existing].name,
                        pending: false,
                        awaiting: false,
                    };
                }
                continue;
            }
            // 首次见此 callId：向前找入参；找不到入参忽略
            const tc = findToolCall(arr, i);
            if (!tc) continue;
            const name = tc.tool || m.name || '';
            out.push({ ...m, content, reasoning, tool_input: toolInputToString(tc), name });
            if (callId) toolIndex.set(callId, out.length - 1);
            continue;
        }

        if (!m.pending && !m.awaiting && m.role === 'assistant') {
            // assistant 不再渲染 tool_calls；仅 tool_calls（无正文/思考/error）的非 pending 消息跳过
            if (!content && !reasoning && !m.error) continue;
        }
        out.push({ ...m, content, reasoning });
    }
    return out;
});

// 自动滚动到底部
watch(
    () => visibleList.value.map((m) => (m.content || '') + (m.reasoning || '') + (m.tool_calls?.length || 0)).join('|'),
    async () => {
        await nextTick();
        if (scroller.value) {
            scroller.value.scrollTop = scroller.value.scrollHeight;
        }
    },
);

function isProcessing(m: AgentMessage): boolean {
    return !!m.pending;
}

/** tool 入参 → 原始字符串：优先 raw（function.arguments 原值），缺失时回退紧凑 JSON */
function toolInputToString(item: { raw?: string; input: any }): string {
    if (typeof item.raw === 'string') return item.raw;
    try { return JSON.stringify(item.input ?? {}); } catch { return String(item.input ?? ''); }
}

/** 工具名 → 展示文案：优先 i18n 翻译；未命中（返回值等于 key）则回退到短名（去掉 webcut. 前缀） */
function toolDisplayName(tool?: string): string {
    if (!tool) return '';
    const key = toolNameI18nKey(tool);
    const translated = t(key);
    return translated && translated !== key ? translated : toolShortName(tool);
}

/** 返回消息正文的渲染方式：'component' / 'html' / 'text' */
function messageRendererKind(m: AgentMessage): 'component' | 'html' | 'text' {
    if (!renderMessage) return 'text';
    try {
        const r = (renderMessage as any)(m);
        if (r && typeof r === 'object') return 'component';
        if (typeof r === 'string') return 'html';
    } catch {}
    return 'text';
}

/** 去除用户消息中的上下文附加块（<user-*> / <webcut-*>），仅显示用户实际输入。
 *  通用匹配前缀，将来新增标签无需改此处。 */
function stripContextBlocks(text: string): string {
    return text
        .replace(/<((?:user|webcut)-[\w-]+)>[\s\S]*?<\/\1>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** 规范化展示文本：统一换行符，清理行尾空白，3+ 连续换行压缩为段落分隔（\n\n），trim 首尾。
 *  注意1：保留 \n\n 作为 markdown 段落/列表分隔，不能合并为单个换行，否则破坏 markdown 渲染。
 *  注意2：不清理行首空白，避免破坏 markdown 缩进式代码块。 */
function normalizeContent(s: string | undefined): string {
    if (!s) return '';
    return s
        .replace(/\r\n?/g, '\n')        // 统一 \r\n / \r → \n
        .replace(/[ \t]+\n/g, '\n')      // 去掉行尾空白
        .replace(/\n{3,}/g, '\n\n')      // 3+ 换行压缩为段落分隔（保留 \n\n 给 markdown）
        .trim();
}

/** 取消息展示用 content：user 需 stripContextBlocks，其余直接用 content */
function displayContent(m: AgentMessage): string {
    const raw = m.role === 'user' ? stripContextBlocks(m.content || '') : (m.content || '');
    return normalizeContent(raw);
}

function submit() {
    const raw = text.value.trim();
    if (!raw || store.isRuning.value) return;
    text.value = '';
    let prompt = buildSubmitText(raw);
    // 把附件槽位数据（如 video_params）也拼进 prompt，LLM 在 user 消息内直接可见
    if (attachments.value.length) {
        prompt += '\n\n<user-operations>\n' + JSON.stringify(attachments.value) + '\n</user-operations>';
    }
    // 上传的附件（仅引用 fileId，不重传文件）
    if (uploadedFiles.value.length) {
        prompt += '\n\n<user-uploads>\n' + JSON.stringify(uploadedFiles.value.map((f) => ({ fileId: f.fileId, type: f.type, name: f.name }))) + '\n</user-uploads>';
    }
    // 外部引用（角色/布景/道具，来自 mentionSlot 选择）
    const extMentions = mentionInputRef.value?.getMentions()?.filter((m: any) => m.external) || [];
    if (extMentions.length) {
        prompt += '\n\n<user-mentions>\n' + JSON.stringify(extMentions.map((m: any) => ({ id: m.sourceKey, name: m.name, type: m.type }))) + '\n</user-mentions>';
    }
    emit('send', prompt, attachments.value);
}

console.debug('!!!--->', visibleList)
</script>

<template>
    <div class="webcut-agent-messages-view">
        <div class="webcut-agent-scroller" ref="scroller">
            <div
                v-for="m in visibleList"
                :key="m.id"
                class="webcut-agent-msg"
                :class="['role-' + m.role, { 'is-error': m.error }]"
            >
                <!-- 用户消息 -->
                <div v-if="m.role === 'user'" class="webcut-agent-bubble user">
                    <MarkdownView :content="m.content" />
                </div>

                <!-- 工具调用：role=tool 时展示，向前合并入参（找不到入参已在 visibleList 过滤） -->
                <div v-else-if="m.role === 'tool'" class="webcut-agent-bubble assistant">
                    <details class="webcut-agent-tool-call">
                        <summary class="webcut-agent-tool-call-summary">
                            <ThinkingText v-if="m.pending || m.awaiting" :text="t('webcut.agent.callTool', { name: toolDisplayName(m.name) })" />
                            <span v-else>{{ t('webcut.agent.callTool', { name: toolDisplayName(m.name) }) }}</span>
                        </summary>
                        <div class="webcut-agent-tool-section">
                            <div class="webcut-agent-tool-section-label">{{ t('webcut.agent.toolInputLabel') }}</div>
                            <pre class="webcut-agent-tool-section-body">{{ m.tool_input }}</pre>
                        </div>
                        <div class="webcut-agent-tool-section">
                            <div class="webcut-agent-tool-section-label">{{ t('webcut.agent.toolResultLabel') }}</div>
                            <pre class="webcut-agent-tool-section-body">{{ m.content }}</pre>
                        </div>
                    </details>
                </div>

                <!-- assistant：不再直接渲染 tool_calls，工具调用统一由上方 role=tool 消息展示 -->
                <div v-else class="webcut-agent-bubble assistant">
                    <details v-if="m.reasoning" class="webcut-agent-reasoning">
                        <summary>{{ m.pending && store.isThinking.value ? t('webcut.agent.thinking') : t('webcut.agent.deepThinking') }}</summary>
                        <pre>{{ m.reasoning }}</pre>
                    </details>
                    <div v-if="m.content" class="webcut-agent-content">
                        <component
                            v-if="messageRendererKind(m) === 'component'"
                            :is="(renderMessage as any)(m)"
                            :content="m.content"
                            :message="m"
                        />
                        <!-- 默认走内置 markdown 渲染（轻量 marked + 基础 XSS 清理） -->
                        <MarkdownView v-else :content="m.content" />
                    </div>
                    <div v-else-if="isProcessing(m)" class="webcut-agent-pending">
                        <ThinkingText :text="store.isThinking.value ? t('webcut.agent.thinking') : t('webcut.agent.processing')" />
                    </div>
                    <div v-if="m.error" class="webcut-agent-msg-error">{{ m.error }}</div>
                </div>
            </div>
        </div>

        <div class="webcut-agent-input-bar">
            <!-- clips bar：选中素材 + 上传附件，横向滚动小方块列表（hover 删除、点击预览） -->
            <ClipsBar :items="clipItems" @delete="onClipDelete" @preview="onClipPreview" />

            <MentionInput ref="mentionInputRef"
                v-model="text"
                :candidates="allCandidates"
                :placeholder="t('webcut.agent.placeholder')"
                :mention-slot="pack?.mentionSlot"
                :render-mention="pack?.adapter?.renderMentionSegment"
                @enter="submit"
            />

            <div class="webcut-agent-input-actions">
                <!-- 上传附件 -->
                <input ref="fileInputRef" type="file" accept="image/*,video/*,audio/*" multiple style="display:none" @change="onFileChange" />
                <button type="button" class="webcut-agent-upload-btn tooltip-host" v-if="pack?.supportsUploadAttachments" :data-tooltip="t('webcut.agent.uploadAttachment')" data-tooltip-pos="top" @click="triggerUpload">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <span style="margin:auto"></span>
                <!-- 操作槽位（margin-left:auto 推到右侧） -->
                <template v-if="operationSlots.length" class="webcut-agent-attachment-slots">
                    <component v-for="(Slot, i) in operationSlots" :key="i" :is="Slot" @attach="onSlotAttach" />
                </template>
                <!-- 思考开关（图标，紧贴发送按钮左侧） -->
                <button
                    type="button"
                    class="webcut-agent-thinking-icon-btn tooltip-host"
                    :class="{ active: enableThinking }"
                    :aria-pressed="enableThinking"
                    :data-tooltip="t('webcut.agent.thinkingSwitch')"
                    data-tooltip-pos="top"
                    @click="enableThinking = !enableThinking"
                >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2C5.5 2 3.5 4 3.5 6.5c0 2 1.3 3.5 2.5 4.5v1.5h4V11c1.2-1 2.5-2.5 2.5-4.5C12.5 4 10.5 2 8 2z"/><path d="M6.5 13.5h3M7 15h2"/></svg>
                </button>
                <button v-if="!store.isRuning.value" type="button" class="webcut-agent-send-btn" :disabled="!text.trim()" @click="submit">
                    {{ t('webcut.agent.send') }}
                </button>
                <button v-else type="button" class="webcut-agent-stop-btn" @click="emit('abort')">
                    {{ t('webcut.agent.stop') }}
                </button>
            </div>
        </div>
        <FilePreviewModal v-if="previewState" :type="previewState.type" :url="previewState.url" :name="previewState.name" @close="previewState = null" />
    </div>
</template>

<style scoped>
.webcut-agent-messages-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.webcut-agent-scroller {
    flex: 1;
    overflow-y: auto;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.webcut-agent-msg { display: flex; width: 100%; }
.role-user { justify-content: flex-end; }
.role-assistant, .role-tool { justify-content: flex-start; }

.webcut-agent-bubble {
    max-width: 88%;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
}
.webcut-agent-bubble.user {
    background-color: var(--webcut-dock-primary, #00b4a2);
    color: #fff;
    border-bottom-right-radius: 2px;
}
.webcut-agent-bubble.assistant {
    background-color: transparent;
    padding: 4px 0;
    border-bottom-left-radius: 0;
}
.webcut-agent-content { margin-top: 2px; }
.webcut-agent-reasoning {
    font-size: 12px;
    opacity: 0.7;
}
.webcut-agent-reasoning summary { cursor: pointer; }
.webcut-agent-reasoning pre {
    margin: 6px 0 0;
    white-space: pre-wrap;
    word-break: break-word;
}
.webcut-agent-reasoning + .webcut-agent-content {
    margin-top: 16px;
}
.webcut-agent-tool-calls {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    margin-bottom: 4px;
}
.webcut-agent-tool-call {
    background-color: transparent;
    padding: 2px 0;
    font-size: 13px;
}
.webcut-agent-tool-call-summary {
    cursor: pointer;
    opacity: 0.85;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
}
.webcut-agent-tool-call-summary::-webkit-details-marker { display: none; }
.webcut-agent-tool-call-summary::before {
    content: '▸';
    font-size: 10px;
    opacity: 0.5;
    transition: transform 0.12s ease;
    display: inline-block;
}
.webcut-agent-tool-call[open] .webcut-agent-tool-call-summary::before {
    transform: rotate(90deg);
}
.webcut-agent-tool-section {
    margin: 6px 0 2px;
    font-size: 12px;
}
.webcut-agent-tool-section-label {
    font-size: 11px;
    opacity: 0.6;
    margin-bottom: 2px;
}
.webcut-agent-tool-section-body {
    margin: 0;
    padding: 6px 8px;
    background-color: var(--webcut-grey-deep-color, #eee);
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.78;
    word-break: break-all;
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
}
.webcut-agent-pending { font-size: 12px; }
.webcut-agent-msg-error { color: var(--webcut-error-color, #d03050); font-size: 12px; margin-top: 4px; }

.webcut-agent-input-bar {
    border-top: 1px solid var(--webcut-line-color);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
}
.webcut-agent-input-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}
.webcut-agent-attachment-slots {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}
.webcut-agent-upload-btn {
    border: none;
    background: transparent;
    color: var(--webcut-text-color, inherit);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: background-color 0.12s ease, opacity 0.12s ease;
}
.webcut-agent-upload-btn:hover:not(:disabled) {
    background-color: var(--webcut-grey-color);
    opacity: 1;
}
.webcut-agent-upload-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
.webcut-agent-thinking-icon-btn {
    border: none;
    background: transparent;
    color: var(--webcut-text-color, inherit);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: background-color 0.12s ease, opacity 0.12s ease;
}
.webcut-agent-thinking-icon-btn:hover { background-color: var(--webcut-grey-color); opacity: 1; }
.webcut-agent-thinking-icon-btn.active { color: var(--webcut-dock-primary, #00b4a2); opacity: 1; }

/* CSS tooltip（::after + data-tooltip） */
.tooltip-host { position: relative; }
.tooltip-host::after {
    content: attr(data-tooltip);
    position: absolute;
    display: none;
    padding: 3px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-size: 11px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 20000;
    pointer-events: none;
}
.tooltip-host:hover::after { display: block; }
.tooltip-host[data-tooltip-pos="top"]::after { bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); }
.tooltip-host[data-tooltip-pos="bottom"]::after { top: calc(100% + 4px); right: 0; }
.webcut-agent-send-btn {
    border: none;
    background-color: var(--webcut-dock-primary, #00b4a2);
    color: #fff;
    padding: 5px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
}
.webcut-agent-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.webcut-agent-stop-btn {
    border: none;
    background-color: var(--webcut-error-color, #d03050);
    color: #fff;
    padding: 5px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
}

/* 选中素材栏 */
.webcut-agent-selected-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 2px 0;
    max-height: 64px;
    overflow-y: auto;
}
.webcut-agent-selected-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: var(--webcut-grey-color);
    border: 1px solid var(--webcut-line-color);
    border-radius: 10px;
    padding: 2px 4px 2px 6px;
    font-size: 11px;
    line-height: 1.4;
    max-width: 100%;
}
.webcut-agent-selected-index {
    font-weight: 700;
    color: var(--webcut-dock-primary, #00b4a2);
}
.webcut-agent-selected-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
}
.webcut-agent-selected-remove {
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
}
.webcut-agent-selected-remove:hover { opacity: 1; }

/* 输入框包裹（用于定位 mention 下拉） */
.webcut-agent-input-wrap {
    position: relative;
}
.webcut-agent-input-wrap textarea {
    width: 100%;
    resize: vertical;
    border: 1px solid var(--webcut-line-color);
    border-radius: 6px;
    padding: 6px 8px;
    outline: none;
    background-color: var(--webcut-background-color);
    color: var(--webcut-text-color);
    font-size: 13px;
    font-family: inherit;
}
.webcut-agent-mention-popover {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 4px);
    border: 1px solid var(--webcut-line-color);
    border-radius: 8px;
    background-color: var(--webcut-background-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
    z-index: 20000;
    overflow: hidden;
    max-height: 200px;
    overflow-y: auto;
}
.webcut-agent-mention-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
}
.webcut-agent-mention-item:hover { background-color: var(--webcut-grey-color); }
.webcut-agent-mention-index { font-weight: 700; color: var(--webcut-dock-primary, #00b4a2); min-width: 28px; }
.webcut-agent-mention-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.webcut-agent-mention-type { opacity: 0.5; font-size: 11px; }
</style>

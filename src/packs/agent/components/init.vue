<script setup lang="ts">
import { computed, inject, ref, type Component } from 'vue';
import { useT } from '../../../i18n/hooks';
import { useWebCutAgentStore, AGENT_RUNTIME_KEY, AGENT_PACK_KEY } from '../store';
import type { WebCutAgentAttachment } from '../adapter';
import { useSelectionMention } from '../composables/use-selection-mention';
import { useAttachments } from '../composables/use-attachments';
import MentionInput from './mention-input.vue';
import ClipsBar from './clips-bar.vue';
import FilePreviewModal from './file-preview-modal.vue';
import type { ClipItem } from './clips-bar.vue';

defineProps<{ hint?: string }>();
const emit = defineEmits<{ (e: 'send', prompt: string, attachments?: WebCutAgentAttachment[]): void }>();
const t = useT();
const store = useWebCutAgentStore();
const { enableThinking } = store;
const text = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewState = ref<null | { type: 'image' | 'video' | 'audio'; url: string; name?: string }>(null);

// 选中素材 + 上传附件
const runtime = inject<any>(AGENT_RUNTIME_KEY, null);
const pack = inject<any>(AGENT_PACK_KEY, null);
const operationSlots: Component[] = pack?.operationSlots || [];
const attachments = ref<WebCutAgentAttachment[]>([]);
function onSlotAttach(payload: WebCutAgentAttachment) {
    if (!payload || !payload.type) return;
    const idx = attachments.value.findIndex((a) => a.type === payload.type);
    if (idx >= 0) attachments.value[idx] = payload;
    else attachments.value.push(payload);
}
const { selectedMaterials, removeMaterial, buildSubmitText } = useSelectionMention(runtime, text);
const { uploadedFiles, upload, removeUpload, previewUpload } = useAttachments(pack?.adapter);

const clipItems = computed<ClipItem[]>(() => {
    let idx = 0;
    const items: ClipItem[] = [];
    for (const m of selectedMaterials.value) {
        idx++;
        items.push({ key: m.sourceKey || `sel_${idx}`, index: idx, name: m.text || m.name, type: m.type });
    }
    for (const f of uploadedFiles.value) {
        idx++;
        items.push({ key: f.fileId, index: idx, name: f.name, type: f.type, url: f.url });
    }
    return items;
});
const allCandidates = computed(() => clipItems.value.map((c) => ({ index: c.index, name: c.name, type: c.type, sourceKey: c.key, url: c.url })));

function onClipDelete(key: string) {
    const clip = clipItems.value.find((c) => c.key === key);
    const oldIndex = clip?.index;
    const material = selectedMaterials.value.find((m) => (m.sourceKey || '') === key);
    if (material) { removeMaterial(material); }
    else { removeUpload(key); }
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
}
function triggerUpload() { fileInputRef.value?.click(); }
async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    for (const file of Array.from(input.files)) await upload(file);
    input.value = '';
}

function submit() {
    const raw = text.value.trim();
    if (!raw || store.isRuning.value) return;
    text.value = '';
    let prompt = buildSubmitText(raw);
    if (attachments.value.length) {
        prompt += '\n\n<user-operations>\n' + JSON.stringify(attachments.value) + '\n</user-operations>';
    }
    if (uploadedFiles.value.length) {
        prompt += '\n\n<user-uploads>\n' + JSON.stringify(uploadedFiles.value.map((f) => ({ fileId: f.fileId, type: f.type, name: f.name }))) + '\n</user-uploads>';
    }
    emit('send', prompt, attachments.value);
}
</script>

<template>
    <div class="webcut-agent-init">
        <div class="webcut-agent-init-title">{{ t('webcut.agent.title') }}</div>
        <div class="webcut-agent-init-hint">{{ hint || t('webcut.agent.emptyHint') }}</div>
        <div class="webcut-agent-init-input">
            <ClipsBar :items="clipItems" @delete="onClipDelete" @preview="onClipPreview" />

            <MentionInput
                v-model="text"
                :candidates="allCandidates"
                :placeholder="t('webcut.agent.placeholder')"
                @enter="submit"
            />

            <div class="webcut-agent-init-row">
                <input ref="fileInputRef" type="file" accept="image/*,video/*,audio/*" multiple style="display:none" @change="onFileChange" />
                <button type="button" class="webcut-agent-upload-btn tooltip-host" v-if="pack?.supportsUploadAttachments" data-tooltip="上传附件" data-tooltip-pos="top" @click="triggerUpload">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <div v-if="operationSlots.length" class="webcut-agent-attachment-slots">
                    <component v-for="(Slot, i) in operationSlots" :key="i" :is="Slot" @attach="onSlotAttach" />
                </div>
                <button type="button" class="webcut-agent-thinking-icon-btn tooltip-host" :class="{ active: enableThinking }" :aria-pressed="enableThinking" data-tooltip="思考" data-tooltip-pos="top" @click="enableThinking = !enableThinking">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2C5.5 2 3.5 4 3.5 6.5c0 2 1.3 3.5 2.5 4.5v1.5h4V11c1.2-1 2.5-2.5 2.5-4.5C12.5 4 10.5 2 8 2z"/><path d="M6.5 13.5h3M7 15h2"/></svg>
                </button>
                <button type="button" class="webcut-agent-send-btn" :disabled="!text.trim()" @click="submit">
                    {{ t('webcut.agent.send') }}
                </button>
            </div>
        </div>
        <FilePreviewModal v-if="previewState" :type="previewState.type" :url="previewState.url" :name="previewState.name" @close="previewState = null" />
    </div>
</template>

<style scoped>
.webcut-agent-init {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 24px 18px;
    gap: 14px;
}
.webcut-agent-init-title {
    font-size: 18px;
    font-weight: 700;
}
.webcut-agent-init-hint {
    color: var(--webcut-text-color);
    opacity: 0.7;
    line-height: 1.6;
}
.webcut-agent-init-input {
    border: 1px solid var(--webcut-line-color);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: var(--webcut-card-color);
}
.webcut-agent-init-input textarea {
    width: 100%;
    resize: vertical;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font-size: 13px;
    font-family: inherit;
}
.webcut-agent-init-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
.webcut-agent-attachment-slots {
    margin-left: auto;
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
.webcut-agent-upload-btn:hover:not(:disabled) { background-color: var(--webcut-grey-color); opacity: 1; }
.webcut-agent-upload-btn:disabled { opacity: 0.3; cursor: not-allowed; }
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
    padding: 5px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
}
.webcut-agent-send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* 选中素材栏（与 messages-view 共用样式） */
.webcut-agent-selected-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 48px;
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
.webcut-agent-selected-index { font-weight: 700; color: var(--webcut-dock-primary, #00b4a2); }
.webcut-agent-selected-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
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

/* 输入框包裹 + mention 下拉（与 messages-view 共用样式） */
.webcut-agent-input-wrap { position: relative; }
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
    max-height: 180px;
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

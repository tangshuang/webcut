<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, type Component } from 'vue';
import { Video, Music, Image, StringText } from '@vicons/carbon';

/** 类型 → icon 组件映射（Vue 模板用） */
const ICON_MAP: Record<string, Component> = { video: Video, audio: Music, image: Image, text: StringText };
function getIconComponent(type?: string): Component {
    return ICON_MAP[type || ''] || StringText;
}

/** 类型 → 内联 SVG 字符串（contentEditable 内 imperative DOM 用，不能依赖 Vue 渲染） */
const SVG_ICONS: Record<string, string> = {
    video: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="9" height="9" rx="1"/><path d="M10.5 6.5l4-2v7l-4-2z"/></svg>',
    audio: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12V3.5l6-1v8.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="10.5" cy="11" r="1.5"/></svg>',
    image: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="M2 11l3.5-3.5L9 11l2-2 3 3"/></svg>',
    text: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M8 4v9"/></svg>',
};
function typeIconSVG(type?: string): string {
    return SVG_ICONS[type || ''] || '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><circle cx="8" cy="8" r="2"/></svg>';
}

/** mention 候选项（由父组件传入，通常是当前选中的素材列表） */
export interface MentionCandidate {
    index: number;      // 1-based 序号，作为 @N 引用值
    name: string;
    type?: string;      // video/audio/image/text
    sourceKey?: string;
    url?: string;       // 缩略图 URL（用于下拉列表展示）
}

interface TextSegment { kind: 'text'; text: string }
interface MentionSegment { kind: 'mention'; index: number; name: string; type?: string; sourceKey?: string }
type Segment = TextSegment | MentionSegment;

const props = withDefaults(defineProps<{
    modelValue?: string;           // 纯文本（含 @N 标记），外部 v-model
    candidates: MentionCandidate[];
    placeholder?: string;
    disabled?: boolean;
}>(), {
    modelValue: '',
    placeholder: '',
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', text: string): void;
    (e: 'enter'): void;
    (e: 'preview', item: MentionCandidate): void;
}>();

const inputRef = ref<HTMLDivElement | null>(null);
const showDropdown = ref(false);
const dropdownFilter = ref('');
const activeIndex = ref(0);
const caretRect = ref<DOMRect | null>(null);
const replacingSegmentEl = ref<HTMLElement | null>(null); // 正在重选的 chip 元素
let isComposing = false;
let lastSignature = '';

const filteredCandidates = computed(() => {
    const q = dropdownFilter.value.toLowerCase().trim();
    if (!q) return props.candidates;
    return props.candidates.filter((c) =>
        String(c.index).includes(q) || c.name.toLowerCase().includes(q),
    );
});

// —— segments → 纯文本（含 @N）——
function segmentsToText(segments: Segment[]): string {
    return segments.map((s) => (s.kind === 'text' ? s.text : `@${s.index}`)).join('');
}

// —— 从 DOM 读取 segments ——
function isMentionNode(node: Node): node is HTMLElement {
    return node.nodeType === Node.ELEMENT_NODE && !!(node as HTMLElement).dataset.mentionIndex;
}

function readSegmentsFromDom(): Segment[] {
    if (!inputRef.value) return [];
    const segments: Segment[] = [];
    const pushText = (t: string) => {
        if (!t) return;
        const last = segments[segments.length - 1];
        if (last?.kind === 'text') last.text += t;
        else segments.push({ kind: 'text', text: t });
    };
    const walk = (node: Node) => {
        if (isMentionNode(node)) {
            const el = node as HTMLElement;
            segments.push({
                kind: 'mention',
                index: Number(el.dataset.mentionIndex || '0'),
                name: el.dataset.mentionName || '',
                type: el.dataset.mentionType || undefined,
                sourceKey: el.dataset.mentionSourceKey || undefined,
            });
            return;
        }
        if (node.nodeType === Node.TEXT_NODE) { pushText(node.textContent || ''); return; }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as HTMLElement).tagName.toLowerCase();
            if (tag === 'br') { pushText('\n'); return; }
            node.childNodes.forEach(walk);
        }
    };
    inputRef.value.childNodes.forEach(walk);
    // 合并相邻 text、去空
    const out: Segment[] = [];
    for (const s of segments) {
        if (s.kind === 'text') {
            if (!s.text) continue;
            const last = out[out.length - 1];
            if (last?.kind === 'text') last.text += s.text;
            else out.push(s);
        } else out.push(s);
    }
    return out;
}

// —— segments → DOM 渲染 ——
function renderSegments(segments: Segment[]) {
    if (!inputRef.value) return;
    inputRef.value.innerHTML = '';
    for (const seg of segments) {
        if (seg.kind === 'text') {
            // 按行拆分，每行一个 text node + br
            const lines = seg.text.split('\n');
            lines.forEach((line, i) => {
                if (i > 0) inputRef.value!.appendChild(document.createElement('br'));
                if (line) inputRef.value!.appendChild(document.createTextNode(line));
            });
        } else {
            inputRef.value.appendChild(createMentionEl(seg));
        }
    }
}

function createMentionEl(seg: MentionSegment): HTMLElement {
    const el = document.createElement('span');
    el.setAttribute('contenteditable', 'false');
    el.dataset.mentionIndex = String(seg.index);
    el.dataset.mentionName = seg.name;
    el.dataset.mentionType = seg.type || '';
    el.dataset.mentionSourceKey = seg.sourceKey || '';
    el.className = 'webcut-mention-chip';
    el.innerHTML = '';

    // 类型 icon（直接用 Vue render 渲染 icon 组件到 span 内）
    const icon = document.createElement('span');
    icon.className = 'webcut-mention-chip-icon';
    icon.innerHTML = typeIconSVG(seg.type);
    icon.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    icon.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        emit('preview', { index: seg.index, name: seg.name, type: seg.type, sourceKey: seg.sourceKey });
    });
    el.appendChild(icon);

    // name（点击重选）
    const name = document.createElement('span');
    name.className = 'webcut-mention-chip-name';
    name.textContent = `@${seg.index} ${seg.name}`;
    name.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    name.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openReplaceDropdown(el);
    });
    el.appendChild(name);

    return el;
}


// —— 光标 offset（在 contentEditable 中按 text + mention 长度计）——
function mentionLength(seg: MentionSegment): number {
    return `@${seg.index}`.length;
}

function getSelectionOffset(): number {
    if (!inputRef.value) return 0;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    let offset = 0;
    let found = false;
    const walk = (node: Node): boolean => {
        if (found) return true;
        if (node === startContainer) {
            if (node.nodeType === Node.TEXT_NODE) { offset += startOffset; found = true; return true; }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const children = Array.from(node.childNodes);
                for (let i = 0; i < Math.min(startOffset, children.length); i++) offset += nodeLength(children[i]);
                found = true;
                return true;
            }
        }
        if (isMentionNode(node)) { offset += nodeLength(node); return false; }
        if (node.nodeType === Node.TEXT_NODE) { offset += (node.textContent || '').length; return false; }
        if (node.nodeType === Node.ELEMENT_NODE) { node.childNodes.forEach(walk); }
        return false;
    };
    walk(inputRef.value);
    return offset;
}

function nodeLength(node: Node): number {
    if (isMentionNode(node)) {
        const idx = Number((node as HTMLElement).dataset.mentionIndex || '0');
        return `@${idx}`.length;
    }
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').length;
    if (node.nodeType === Node.ELEMENT_NODE) {
        let l = 0;
        node.childNodes.forEach((c) => { l += nodeLength(c); });
        return l;
    }
    return 0;
}

function setCaretByOffset(offset: number) {
    if (!inputRef.value) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let cur = 0;
    let placed = false;
    const placeAfter = (node: Node) => { range.setStartAfter(node); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); };
    const placeBefore = (node: Node) => { range.setStartBefore(node); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); };
    const placeInText = (node: Node, local: number) => { range.setStart(node, Math.max(0, local)); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); };
    const walk = (node: Node): boolean => {
        if (placed) return true;
        if (isMentionNode(node)) {
            const len = nodeLength(node);
            const next = cur + len;
            if (offset <= cur) { placeBefore(node); placed = true; return true; }
            if (offset <= next) { placeAfter(node); placed = true; return true; }
            cur = next; return false;
        }
        if (node.nodeType === Node.ELEMENT_NODE) { for (const c of Array.from(node.childNodes)) if (walk(c)) return true; return false; }
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            const next = cur + text.length;
            if (offset <= next) { placeInText(node, offset - cur); placed = true; return true; }
            cur = next;
        }
        return false;
    };
    walk(inputRef.value);
    if (!placed) { range.selectNodeContents(inputRef.value); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); }
}

// —— 检测光标处是否有激活的 @（返回 filter + start offset）——
function getActiveMention(): { filter: string; start: number } | null {
    const segments = readSegmentsFromDom();
    const pos = getSelectionOffset();
    let offset = 0, filter = '', start = -1, active = false;
    for (const seg of segments) {
        const segText = seg.kind === 'text' ? seg.text : `@${seg.index}`;
        const segLen = segText.length;
        if (seg.kind === 'mention') {
            if (offset >= pos) break;
            offset += segLen; filter = ''; start = -1; active = false; continue;
        }
        const maxI = Math.min(segLen, pos - offset);
        for (let i = 0; i < maxI; i++) {
            const ch = segText[i];
            if (/\s/.test(ch)) { filter = ''; start = -1; active = false; continue; }
            if (ch === '@') { filter = ''; start = offset + i; active = true; continue; }
            if (active) filter += ch;
        }
        offset += segLen;
        if (offset >= pos) break;
    }
    if (!active || start < 0) return null;
    return { filter, start };
}

// —— caret 位置（用于定位 dropdown）——
function getCaretRect(): DOMRect | null {
    if (!inputRef.value) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!inputRef.value.contains(range.startContainer)) return null;
    const r = range.cloneRange(); r.collapse(true);
    const rects = r.getClientRects();
    const rect = rects.length > 0 ? rects[rects.length - 1] : r.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0 || rect.left !== 0 || rect.top !== 0)) return rect;
    return inputRef.value.getBoundingClientRect();
}

// —— 处理 input ——
function processInput() {
    const segments = readSegmentsFromDom();
    const text = segmentsToText(segments);
    const sig = text;
    if (sig !== lastSignature) {
        lastSignature = sig;
        emit('update:modelValue', text);
    }
    const active = getActiveMention();
    if (active) {
        dropdownFilter.value = active.filter;
        showDropdown.value = true;
        activeIndex.value = 0;
        caretRect.value = getCaretRect();
    } else {
        showDropdown.value = false;
        replacingSegmentEl.value = null;
        dropdownFilter.value = '';
    }
}

function onInput() {
    if (props.disabled || isComposing) return;
    processInput();
}
function onCompositionStart() { isComposing = true; }
function onCompositionEnd() { isComposing = false; setTimeout(() => processInput(), 0); }

function onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const lines = text.split('\n');
    const frag = document.createDocumentFragment();
    lines.forEach((line, i) => {
        if (i > 0) frag.appendChild(document.createElement('br'));
        if (line) frag.appendChild(document.createTextNode(line));
    });
    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
    processInput();
}

// —— 插入 mention ——
function insertMention(item: MentionCandidate) {
    if (!inputRef.value) return;
    const segments = readSegmentsFromDom();
    const mentionSeg: MentionSegment = { kind: 'mention', index: item.index, name: item.name, type: item.type, sourceKey: item.sourceKey };
    let nextSegments: Segment[] = [];

    if (replacingSegmentEl.value) {
        // 重选：替换对应 segment
        const replaceIdx = Number(replacingSegmentEl.value.dataset.mentionIndex);
        nextSegments = segments.map((s) =>
            s.kind === 'mention' && s.index === replaceIdx ? mentionSeg : s,
        );
    } else {
        const active = getActiveMention();
        if (!active) return;
        const pos = getSelectionOffset();
        // 把 [active.start, pos) 替换为 mention
        let offset = 0;
        const before: Segment[] = [];
        const after: Segment[] = [];
        let inserted = false;
        const pushText = (arr: Segment[], t: string) => {
            if (!t) return;
            const last = arr[arr.length - 1];
            if (last?.kind === 'text') last.text += t;
            else arr.push({ kind: 'text', text: t });
        };
        for (const seg of segments) {
            const segText = seg.kind === 'text' ? seg.text : `@${seg.index}`;
            const segStart = offset;
            const segEnd = offset + segText.length;
            if (segEnd <= active.start) { before.push(seg); offset = segEnd; continue; }
            if (segStart >= pos) { after.push(seg); offset = segEnd; continue; }
            if (seg.kind === 'text') {
                const beforeText = seg.text.slice(0, Math.max(0, active.start - segStart));
                const afterText = seg.text.slice(Math.max(0, pos - segStart));
                if (beforeText) pushText(before, beforeText);
                if (!inserted) { before.push(mentionSeg); inserted = true; }
                if (afterText) pushText(after, afterText);
            }
            offset = segEnd;
        }
        if (!inserted) before.push(mentionSeg);
        nextSegments = [...before, ...after];
    }

    renderSegments(nextSegments);
    lastSignature = segmentsToText(nextSegments);
    emit('update:modelValue', lastSignature);
    showDropdown.value = false;
    replacingSegmentEl.value = null;
    dropdownFilter.value = '';
    // 光标放到 mention 后
    nextTick(() => {
        if (!inputRef.value) return;
        inputRef.value.focus();
        // 找到刚插入的 mention 元素，光标放其后
        const mentionEls = inputRef.value.querySelectorAll('[data-mention-index]');
        const targetEl = Array.from(mentionEls).find((el) => Number((el as HTMLElement).dataset.mentionIndex) === item.index) as HTMLElement | undefined;
        if (targetEl) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.setStartAfter(targetEl);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    });
}

// —— 打开重选 dropdown（点击 chip name）——
function openReplaceDropdown(el: HTMLElement) {
    if (props.disabled) return;
    replacingSegmentEl.value = el;
    dropdownFilter.value = '';
    showDropdown.value = true;
    activeIndex.value = 0;
    caretRect.value = el.getBoundingClientRect();
}

// —— 键盘导航 ——
function onKeydown(e: KeyboardEvent) {
    if (props.disabled) return;
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (showDropdown.value) {
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = Math.min(activeIndex.value + 1, filteredCandidates.value.length - 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = Math.max(activeIndex.value - 1, 0); return; }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const item = filteredCandidates.value[activeIndex.value];
            if (item) insertMention(item);
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); showDropdown.value = false; replacingSegmentEl.value = null; return; }
        return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        emit('enter');
        return;
    }
}

// —— 外部 modelValue 变化 → 同步到 DOM（仅当差异时）——
watch(() => props.modelValue, (val) => {
    if (val === lastSignature) return;
    // 从纯文本重建 segments（简单解析 @N）
    const segments = parseTextToSegments(val);
    renderSegments(segments);
    lastSignature = val;
}, { immediate: false });

function parseTextToSegments(text: string): Segment[] {
    const segments: Segment[] = [];
    const pushText = (t: string) => { if (!t) return; const last = segments[segments.length - 1]; if (last?.kind === 'text') last.text += t; else segments.push({ kind: 'text', text: t }); };
    const re = /@(\d+)/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > last) pushText(text.slice(last, m.index));
        const idx = Number(m[1]);
        const cand = props.candidates.find((c) => c.index === idx);
        segments.push({ kind: 'mention', index: idx, name: cand?.name || `#${idx}`, type: cand?.type, sourceKey: cand?.sourceKey });
        last = m.index + m[0].length;
    }
    if (last < text.length) pushText(text.slice(last));
    return segments;
}

// —— 关闭 dropdown（点击外部）——
function onDocMousedown(e: MouseEvent) {
    const target = e.target as Node;
    if (inputRef.value?.contains(target)) return;
    // 检查是否点在 dropdown 内
    const dropdown = document.querySelector('.webcut-mention-dropdown');
    if (dropdown?.contains(target)) return;
    showDropdown.value = false;
    replacingSegmentEl.value = null;
}

onMounted(() => {
    // 初始渲染
    const segments = parseTextToSegments(props.modelValue);
    renderSegments(segments);
    lastSignature = props.modelValue;
    document.addEventListener('mousedown', onDocMousedown);
});
onBeforeUnmount(() => {
    document.removeEventListener('mousedown', onDocMousedown);
});
</script>

<template>
    <div class="webcut-mention-input-wrap">
        <div
            ref="inputRef"
            class="webcut-mention-input"
            :class="{ disabled }"
            :contenteditable="!disabled"
            :data-placeholder="placeholder"
            @input="onInput"
            @keydown="onKeydown"
            @paste="onPaste"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
        ></div>

        <!-- @ 下拉列表 -->
        <div
            v-if="showDropdown && filteredCandidates.length"
            class="webcut-mention-dropdown"
            :style="caretRect ? { left: '0px', bottom: '100%' } : {}"
        >
            <button
                v-for="(item, i) in filteredCandidates"
                :key="item.sourceKey || item.index"
                type="button"
                class="webcut-mention-dropdown-item"
                :class="{ active: i === activeIndex }"
                @mousedown.prevent="insertMention(item)"
                @mouseenter="activeIndex = i"
            >
                <span class="webcut-mention-dropdown-thumb">
                    <img v-if="item.url && item.type === 'image'" :src="item.url" :alt="item.name" />
                    <video v-else-if="item.url && item.type === 'video'" :src="item.url" muted preload="metadata" />
                    <component v-else :is="getIconComponent(item.type)" class="webcut-mention-dropdown-icon" :size="12" />
                </span>
                <span class="webcut-mention-dropdown-index">@{{ item.index }}</span>
                <span class="webcut-mention-dropdown-name">{{ item.name }}</span>
                <span class="webcut-mention-dropdown-type">{{ item.type }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.webcut-mention-input-wrap {
    position: relative;
}
.webcut-mention-input {
    width: 100%;
    min-height: 36px;
    max-height: 200px;
    overflow-y: auto;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--webcut-text-color);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.5;
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
}
.webcut-mention-input.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.webcut-mention-input:empty::before {
    content: attr(data-placeholder);
    color: var(--webcut-text-color);
    opacity: 0.4;
}

/* mention chip */
:deep(.webcut-mention-chip) {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: var(--webcut-grey-color);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    user-select: none;
    margin: 0 1px;
}
:deep(.webcut-mention-chip-icon) {
    cursor: pointer;
    font-size: 11px;
    opacity: 0.7;
}
:deep(.webcut-mention-chip-icon:hover) { opacity: 1; }
:deep(.webcut-mention-chip-name) {
    cursor: pointer;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
}

/* dropdown */
.webcut-mention-dropdown {
    position: absolute;
    left: 0;
    bottom: 100%;
    margin-bottom: 4px;
    z-index: 20000;
    min-width: 180px;
    max-width: 280px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--webcut-line-color);
    border-radius: 8px;
    background-color: var(--webcut-background-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
    padding: 4px;
}
.webcut-mention-dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: transparent;
    color: inherit;
    padding: 6px 8px;
    border-radius: 5px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.webcut-mention-dropdown-item:hover,
.webcut-mention-dropdown-item.active {
    background-color: var(--webcut-grey-color);
}
.webcut-mention-dropdown-thumb {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--webcut-grey-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.webcut-mention-dropdown-thumb img,
.webcut-mention-dropdown-thumb video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.webcut-mention-dropdown-icon {
    font-size: 12px;
    opacity: 0.6;
}
.webcut-mention-dropdown-index { font-weight: 700; color: var(--webcut-dock-primary, #00b4a2); min-width: 24px; }
.webcut-mention-dropdown-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.webcut-mention-dropdown-type { opacity: 0.5; font-size: 10px; text-transform: uppercase; }
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, type Component } from 'vue';
import { Video, Music, Image, StringText } from '@vicons/carbon';
import FilePreviewModal from './file-preview-modal.vue';

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

/** mention 可切换的视角（角色头像/四视图/嗓音，布景/道具的多张图等） */
export interface MentionViewOption { id: string; name: string; fileId?: string; url?: string; mediaType?: 'image' | 'audio' | 'video' }

/** mention 候选项（由父组件传入，通常是当前选中的素材列表） */
export interface MentionCandidate {
    index: number;      // 1-based 序号，作为 @N 引用值；0 表示无序号（外部引用，用 @name）
    name: string;
    type?: string;      // video/audio/image/text
    sourceKey?: string;
    url?: string;       // 缩略图 URL（用于下拉列表展示）
    external?: boolean;  // true → 使用 @{name} 格式（上传文件等非编辑器素材）
    viewOptions?: MentionViewOption[];  // 可切换视角列表（角色/布景/道具等）
}

/** mentionSlot 的 select 事件固定返回格式 */
export interface MentionSelectValue {
    id: string;         // 唯一标识（sourceKey / fileId / characterId 等）
    name: string;       // 显示名
    type?: string;      // 类型
    url?: string;       // 缩略图 URL
    viewOptions?: MentionViewOption[];  // 可切换视角列表
}

interface TextSegment { kind: 'text'; text: string }
interface MentionSegment {
    kind: 'mention';
    index: number;
    name: string;
    type?: string;
    sourceKey?: string;
    external?: boolean;
    url?: string;
    viewOptions?: MentionViewOption[];
    selectedViewId?: string;
}
type Segment = TextSegment | MentionSegment;

const props = withDefaults(defineProps<{
    modelValue?: string;           // 纯文本（含 @N 标记），外部 v-model
    candidates: MentionCandidate[];
    placeholder?: string;
    disabled?: boolean;
    /** 自定义 @ 弹窗组件；传入后替换默认 dropdown。组件接收 { resources: MentionCandidate[] }，emit select(MentionSelectValue) */
    mentionSlot?: Component;
    /** 自定义 mention chip 内缩略图渲染（返回 HTMLElement 替换默认 icon）。openPreviewModal 用于在点击元素时打开内置预览弹窗 */
    renderMention?: (seg: { name: string; type?: string; sourceKey?: string; url?: string; external?: boolean; mediaType?: 'image' | 'audio' | 'video'; fileId?: string }, openPreviewModal?: (item: { type: 'image' | 'video' | 'audio'; url: string; name?: string }) => void) => HTMLElement;
}>(), {
    modelValue: '',
    placeholder: '',
    disabled: false,
});

/** 内置预览弹窗状态 */
const previewState = ref<null | { type: 'image' | 'video' | 'audio'; url: string; name?: string }>(null);
/** 打开内置预览弹窗（供 chip 内 icon 点击与 adapter renderMentionSegment 复用） */
function openPreviewModal(item: { type?: string; url?: string; name?: string; mediaType?: 'image' | 'audio' | 'video'; fileId?: string }) {
    const url = item.url || '';
    const type: 'image' | 'video' | 'audio' = item.mediaType === 'audio' ? 'audio'
        : item.mediaType === 'video' ? 'video'
        : (item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image');
    if (!url && type !== 'audio') return;
    previewState.value = { type, url, name: item.name };
}

const emit = defineEmits<{
    (e: 'update:modelValue', text: string): void;
    (e: 'enter'): void;
    (e: 'preview', item: { index: number; name: string; type?: string; sourceKey?: string; url?: string }): void;
}>();

const inputRef = ref<HTMLDivElement | null>(null);
const showDropdown = ref(false);
const dropdownFilter = ref('');
const activeIndex = ref(0);
const caretRect = ref<DOMRect | null>(null);
const slotPos = ref<{ top?: string; bottom?: string; left: string; maxWidth: string; maxHeight: string } | null>(null);
const replacingSegmentEl = ref<HTMLElement | null>(null);
// mentionSlot 键盘导航：activeIndex + confirmSignal（Enter 触发选择）+ slotItemCount（popover 回报总数）
const slotActiveIndex = ref(0);
const confirmSignal = ref(0);
const slotItemCount = ref(0);
const slotColumnCounts = ref<number[]>([]);

/** 横向移动：基于 columnCounts 计算相邻列同行的 flat index */
function slotMoveHorizontal(dir: -1 | 1) {
    const cols = slotColumnCounts.value;
    if (!cols.length) return;
    let col = 0, row = 0, acc = 0;
    for (let i = 0; i < cols.length; i++) {
        if (slotActiveIndex.value < acc + cols[i]) { col = i; row = slotActiveIndex.value - acc; break; }
        acc += cols[i];
    }
    const nextCol = col + dir;
    if (nextCol < 0 || nextCol >= cols.length || !cols[nextCol]) return;
    const nextRow = Math.min(row, cols[nextCol] - 1);
    let newIdx = 0;
    for (let i = 0; i < nextCol; i++) newIdx += cols[i];
    slotActiveIndex.value = newIdx + nextRow;
} // 正在重选的 chip 元素
let isComposing = false;
let lastSignature = '';

/** 为 mentionSlot 计算弹窗位置（Teleport to body 用 fixed 定位，避免被 sidebar overflow 裁剪） */
function computeSlotPos() {
    const rect = caretRect.value || replacingSegmentEl.value?.getBoundingClientRect() || null;
    if (!rect) { slotPos.value = null; return; }
    const gap = 4;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    const showBelow = spaceAbove < 200 && spaceBelow > spaceAbove;
    const availH = Math.max((showBelow ? spaceBelow : spaceAbove) - gap, 100);
    const estW = 500;
    slotPos.value = {
        top: showBelow ? `${rect.bottom + gap}px` : undefined,
        bottom: showBelow ? undefined : `${Math.round(vh - rect.top + gap)}px`,
        left: `${Math.max(pad, Math.min(rect.left, vw - estW - pad))}px`,
        maxWidth: `${vw - 2 * pad}px`,
        maxHeight: `${Math.min(availH, 380)}px`,
    };
}

const filteredCandidates = computed(() => {
    const q = dropdownFilter.value.toLowerCase().trim();
    if (!q) return props.candidates;
    return props.candidates.filter((c) =>
        String(c.index).includes(q) || c.name.toLowerCase().includes(q),
    );
});

// —— segments → 纯文本（含 @N 或 @{name}）——
function segmentsToText(segments: Segment[]): string {
    return segments.map((s) => {
        if (s.kind === 'text') return s.text;
        return s.external ? `@{${s.name}}` : `@${s.index}`;
    }).join('');
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
            let viewOptions: MentionViewOption[] | undefined;
            try {
                const raw = el.dataset.mentionViewOptions;
                if (raw) viewOptions = JSON.parse(raw);
            } catch {}
            segments.push({
                kind: 'mention',
                index: Number(el.dataset.mentionIndex || '0'),
                name: el.dataset.mentionName || '',
                type: el.dataset.mentionType || undefined,
                sourceKey: el.dataset.mentionSourceKey || undefined,
                external: el.dataset.mentionExternal === '1',
                url: el.dataset.mentionUrl || undefined,
                viewOptions,
                selectedViewId: el.dataset.mentionSelectedView || undefined,
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

/** 当前视角（多视角时取 selectedViewId 对应项，否则 undefined） */
function selectedViewOf(seg: MentionSegment): MentionViewOption | undefined {
    if (!seg.viewOptions || seg.viewOptions.length === 0) return undefined;
    return seg.viewOptions.find((v) => v.id === seg.selectedViewId) || seg.viewOptions[0];
}

/** chip 显示文本（external 多视角时附带视角名） */
function chipDisplayText(seg: MentionSegment): string {
    if (!seg.external) return `@${seg.index} ${seg.name}`;
    const view = selectedViewOf(seg);
    return view ? `@${seg.name}（${view.name}）` : `@${seg.name}`;
}

/** 渲染 icon 内容到容器（首次渲染与切换视角时复用） */
function renderIconInto(icon: HTMLElement, seg: MentionSegment) {
    icon.innerHTML = '';
    const view = selectedViewOf(seg);
    const url = view?.url || seg.url;
    const mediaType = view?.mediaType;
    const fileId = view?.fileId;
    if (props.renderMention) {
        try {
            const custom = props.renderMention({ name: seg.name, type: seg.type, sourceKey: seg.sourceKey, url, external: seg.external, mediaType, fileId }, openPreviewModal);
            if (custom) { icon.innerHTML = ''; icon.appendChild(custom); }
            else icon.innerHTML = typeIconSVG(mediaType || seg.type);
        } catch { icon.innerHTML = typeIconSVG(mediaType || seg.type); }
    } else if (url && seg.type === 'image' && mediaType !== 'audio') {
        const img = document.createElement('img');
        img.src = url; img.alt = seg.name;
        icon.appendChild(img);
    } else if (url && seg.type === 'video' && mediaType !== 'audio') {
        const vid = document.createElement('video');
        vid.src = url; vid.muted = true; vid.preload = 'metadata';
        icon.appendChild(vid);
    } else {
        icon.innerHTML = typeIconSVG(mediaType || seg.type);
    }
}

function createMentionEl(seg: MentionSegment): HTMLElement {
    const el = document.createElement('span');
    el.setAttribute('contenteditable', 'false');
    el.dataset.mentionIndex = String(seg.index);
    el.dataset.mentionName = seg.name;
    el.dataset.mentionType = seg.type || '';
    el.dataset.mentionSourceKey = seg.sourceKey || '';
    el.dataset.mentionExternal = seg.external ? '1' : '0';
    el.dataset.mentionUrl = seg.url || '';
    if (seg.viewOptions && seg.viewOptions.length) {
        el.dataset.mentionViewOptions = JSON.stringify(seg.viewOptions);
        if (seg.selectedViewId) el.dataset.mentionSelectedView = seg.selectedViewId;
    }
    el.className = 'webcut-mention-chip';
    el.innerHTML = '';

    // 缩略图 / 类型 icon：点击打开内置预览弹窗（adapter 路径由 renderMentionSegment 内部绑定，此处仅兜底）
    const icon = document.createElement('span');
    icon.className = 'webcut-mention-chip-icon';
    renderIconInto(icon, seg);
    icon.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    if (!props.renderMention) {
        const view = selectedViewOf(seg);
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            openPreviewModal({ name: seg.name, type: seg.type, url: view?.url || seg.url, mediaType: view?.mediaType, fileId: view?.fileId });
        });
    }
    el.appendChild(icon);

    // name（点击重选）：external 用 @name（多视角附带视角名），internal 用 @index name
    const name = document.createElement('span');
    name.className = 'webcut-mention-chip-name';
    name.textContent = chipDisplayText(seg);
    name.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    name.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openReplaceDropdown(el);
    });
    el.appendChild(name);

    // 多视角切换按钮（external 且视角数 > 1）
    const views = seg.viewOptions || [];
    if (seg.external && views.length > 1) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'webcut-mention-chip-toggle';
        toggle.innerHTML = '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
        toggle.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
        toggle.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            openViewMenu(el);
        });
        el.appendChild(toggle);
    }

    return el;
}

/** 切换视角：用新 segment 重建 chip 并替换原节点 */
function applyViewToChip(el: HTMLElement, view: MentionViewOption) {
    let viewOptions: MentionViewOption[] = [];
    try { viewOptions = JSON.parse(el.dataset.mentionViewOptions || '[]'); } catch {}
    const seg: MentionSegment = {
        kind: 'mention',
        index: Number(el.dataset.mentionIndex || '0'),
        name: el.dataset.mentionName || '',
        type: el.dataset.mentionType || undefined,
        sourceKey: el.dataset.mentionSourceKey || undefined,
        external: el.dataset.mentionExternal === '1',
        url: view.url || el.dataset.mentionUrl || '',
        viewOptions,
        selectedViewId: view.id,
    };
    const newEl = createMentionEl(seg);
    el.replaceWith(newEl);
    openViewMenuState.value = null;
    // 文本 @{name} 未变，无需 emit；保持输入框焦点
    nextTick(() => {
        if (!inputRef.value) return;
        inputRef.value.focus();
        const sel = window.getSelection();
        if (sel) {
            const range = document.createRange();
            range.setStartAfter(newEl);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
}

/** 打开视角切换菜单 */
const openViewMenuState = ref<{ rect: DOMRect; viewOptions: MentionViewOption[]; selectedViewId?: string; chipEl: HTMLElement } | null>(null);
function openViewMenu(el: HTMLElement) {
    let viewOptions: MentionViewOption[] = [];
    try { viewOptions = JSON.parse(el.dataset.mentionViewOptions || '[]'); } catch {}
    if (viewOptions.length <= 1) return;
    const selectedViewId = el.dataset.mentionSelectedView || viewOptions[0]?.id;
    openViewMenuState.value = { rect: el.getBoundingClientRect(), viewOptions, selectedViewId, chipEl: el };
}


// —— 光标 offset（在 contentEditable 中按 text + mention 长度计）——
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
        if (node.nodeType === Node.ELEMENT_NODE) {
            // <br> 按 \n 计 1 字符（与 readSegmentsFromDom 一致）
            if ((node as HTMLElement).tagName.toLowerCase() === 'br') { offset += 1; return false; }
            node.childNodes.forEach(walk);
        }
        return false;
    };
    walk(inputRef.value);
    return offset;
}

function nodeLength(node: Node): number {
    if (isMentionNode(node)) {
        const el = node as HTMLElement;
        const idx = Number(el.dataset.mentionIndex || '0');
        const name = el.dataset.mentionName || '';
        return el.dataset.mentionExternal === '1' ? `@{${name}}`.length : `@${idx}`.length;
    }
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').length;
    if (node.nodeType === Node.ELEMENT_NODE) {
        // <br> 按 \n 计 1 字符（与 readSegmentsFromDom 一致）
        if ((node as HTMLElement).tagName.toLowerCase() === 'br') return 1;
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
        if (node.nodeType === Node.ELEMENT_NODE) {
            // <br> 按 \n 计 1 字符
            if ((node as HTMLElement).tagName.toLowerCase() === 'br') {
                const next = cur + 1;
                if (offset <= cur) { placeBefore(node); placed = true; return true; }
                if (offset <= next) { placeAfter(node); placed = true; return true; }
                cur = next; return false;
            }
            for (const c of Array.from(node.childNodes)) if (walk(c)) return true;
            return false;
        }
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
        const segText = seg.kind === 'text' ? seg.text : (seg.external ? `@{${seg.name}}` : `@${seg.index}`);
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
        slotActiveIndex.value = 0;
        caretRect.value = getCaretRect();
        if (props.mentionSlot) computeSlotPos();
    } else {
        showDropdown.value = false;
        replacingSegmentEl.value = null;
        dropdownFilter.value = '';
        slotPos.value = null;
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
    // 外部引用（上传文件等）：走 @{name} 格式
    if (item.external) { onSlotSelect({ id: item.sourceKey || item.name, name: item.name, type: item.type, url: item.url }); return; }
    const segments = readSegmentsFromDom();
    const mentionSeg: MentionSegment = { kind: 'mention', index: item.index, name: item.name, type: item.type, sourceKey: item.sourceKey, url: item.url };
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
            const segText = seg.kind === 'text' ? seg.text : (seg.external ? `@{${seg.name}}` : `@${seg.index}`);
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

/** 根据 chip DOM 元素定位其在 segments 数组中的索引（按 mention 出现顺序匹配） */
function findSegmentIndexForChip(chipEl: HTMLElement): number {
    if (!inputRef.value) return -1;
    const mentionEls = Array.from(inputRef.value.querySelectorAll('[data-mention-index]')) as HTMLElement[];
    const domIdx = mentionEls.indexOf(chipEl);
    if (domIdx < 0) return -1;
    const segments = readSegmentsFromDom();
    let mentionCount = 0;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i].kind === 'mention') {
            if (mentionCount === domIdx) return i;
            mentionCount++;
        }
    }
    return -1;
}

/** 替换模式：用新候选替换 replacingSegmentEl 对应的 chip（支持 internal @N 与 external 角色/布景/道具/上传文件） */
function replaceMentionChip(value: MentionSelectValue) {
    if (!replacingSegmentEl.value || !inputRef.value) return;
    const replaceIdx = findSegmentIndexForChip(replacingSegmentEl.value);
    if (replaceIdx < 0) {
        replacingSegmentEl.value = null;
        showDropdown.value = false;
        slotPos.value = null;
        return;
    }
    const segments = readSegmentsFromDom();
    const existing = props.candidates.find((c) => c.sourceKey === value.id && !c.external);
    let newSeg: MentionSegment;
    if (existing) {
        newSeg = { kind: 'mention', index: existing.index, name: existing.name, type: existing.type, sourceKey: existing.sourceKey, url: existing.url };
    } else {
        const viewOptions = value.viewOptions && value.viewOptions.length > 1 ? value.viewOptions : undefined;
        const selectedViewId = viewOptions
            ? (viewOptions.find((v) => v.url === value.url)?.id || viewOptions[0]?.id)
            : undefined;
        newSeg = { kind: 'mention', index: 0, name: value.name, type: value.type, sourceKey: value.id, external: true, url: value.url, viewOptions, selectedViewId };
    }
    const next = [...segments];
    next[replaceIdx] = newSeg;
    renderSegments(next);
    lastSignature = segmentsToText(next);
    emit('update:modelValue', lastSignature);
    showDropdown.value = false;
    replacingSegmentEl.value = null;
    dropdownFilter.value = '';
    slotPos.value = null;
    nextTick(() => {
        if (!inputRef.value) return;
        inputRef.value.focus();
        const mentionEls = Array.from(inputRef.value.querySelectorAll('[data-mention-index]')) as HTMLElement[];
        const target = mentionEls[replaceIdx];
        if (target) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.setStartAfter(target);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    });
}

/** mentionSlot 的 select 回调：替换模式优先；否则在 candidates 中查找（仅 internal @N 候选）→ 命中则走 insertMention；未命中则插入外部 mention chip（@{name} 格式） */
function onSlotSelect(value: MentionSelectValue) {
    if (replacingSegmentEl.value) { replaceMentionChip(value); return; }
    const existing = props.candidates.find((c) => c.sourceKey === value.id && !c.external);
    if (existing) { insertMention(existing); return; }
    // 外部 mention：构造 segment 并替换当前 @filter 区域
    if (!inputRef.value) return;
    const active = getActiveMention();
    if (!active) return;
    const pos = getSelectionOffset();
    const viewOptions = value.viewOptions && value.viewOptions.length > 1 ? value.viewOptions : undefined;
    const selectedViewId = viewOptions
        ? (viewOptions.find((v) => v.url === value.url)?.id || viewOptions[0]?.id)
        : undefined;
    const extSeg: MentionSegment = { kind: 'mention', index: 0, name: value.name, type: value.type, sourceKey: value.id, external: true, url: value.url, viewOptions, selectedViewId };
    const segments = readSegmentsFromDom();
    const next: Segment[] = [];
    let offset = 0; let inserted = false;
    const pushText = (t: string) => { if (!t) return; const last = next[next.length - 1]; if (last?.kind === 'text') last.text += t; else next.push({ kind: 'text', text: t }); };
    for (const seg of segments) {
        const segText = seg.kind === 'text' ? seg.text : (seg.external ? `@{${seg.name}}` : `@${seg.index}`);
        const segStart = offset; const segEnd = offset + segText.length;
        if (segEnd <= active.start || segStart >= pos) { next.push(seg); offset = segEnd; continue; }
        if (seg.kind === 'text') {
            const before = seg.text.slice(0, Math.max(0, active.start - segStart));
            const after = seg.text.slice(Math.max(0, pos - segStart));
            if (before) pushText(before);
            if (!inserted) { next.push(extSeg); inserted = true; }
            if (after) pushText(after);
        }
        offset = segEnd;
    }
    if (!inserted) next.push(extSeg);
    renderSegments(next);
    const text = segmentsToText(next);
    lastSignature = text;
    emit('update:modelValue', text);
    showDropdown.value = false;
    replacingSegmentEl.value = null;
    nextTick(() => {
        if (!inputRef.value) return;
        inputRef.value.focus();
        const chips = inputRef.value.querySelectorAll('[data-mention-external="1"]');
        const target = Array.from(chips).find((el) => (el as HTMLElement).dataset.mentionName === value.name) as HTMLElement | undefined;
        if (target) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.setStartAfter(target);
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
    slotActiveIndex.value = 0;
    caretRect.value = el.getBoundingClientRect();
    if (props.mentionSlot) computeSlotPos();
}

// —— 键盘导航 ——
function onKeydown(e: KeyboardEvent) {
    if (props.disabled) return;
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (showDropdown.value) {
        // mentionSlot 模式：键盘导航走 slotActiveIndex + confirmSignal
        if (props.mentionSlot) {
            if (e.key === 'ArrowDown') { e.preventDefault(); slotActiveIndex.value = Math.min(slotActiveIndex.value + 1, Math.max(slotItemCount.value - 1, 0)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); slotActiveIndex.value = Math.max(slotActiveIndex.value - 1, 0); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); slotMoveHorizontal(-1); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); slotMoveHorizontal(1); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); confirmSignal.value++; return; }
            if (e.key === 'Escape') { e.preventDefault(); showDropdown.value = false; slotPos.value = null; return; }
            return;
        }
        // 默认 dropdown 键盘导航
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
    // 匹配 @N（内部资源引用）和 @{name}（外部引用，如 aiman 角色/布景/道具）
    const re = /@(\d+)|@\{([^}]+)\}/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > last) pushText(text.slice(last, m.index));
        if (m[1]) {
            // @N 格式
            const idx = Number(m[1]);
            const cand = props.candidates.find((c) => c.index === idx);
            segments.push({ kind: 'mention', index: idx, name: cand?.name || `#${idx}`, type: cand?.type, sourceKey: cand?.sourceKey });
        } else if (m[2]) {
            // @{name} 格式（外部引用）：从 candidates 恢复 type/sourceKey/url/viewOptions
            const cand = props.candidates.find((c) => c.external && (c.name === m[2] || c.sourceKey === m[2]));
            segments.push({
                kind: 'mention',
                index: 0,
                name: m[2],
                external: true,
                type: cand?.type,
                sourceKey: cand?.sourceKey,
                url: cand?.url,
                viewOptions: cand?.viewOptions,
                selectedViewId: cand?.viewOptions && cand.viewOptions.length > 1 ? (cand.viewOptions.find((v) => v.url === cand.url)?.id || cand.viewOptions[0]?.id) : undefined,
            });
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) pushText(text.slice(last));
    return segments;
}

// —— 关闭 dropdown（点击外部）——
function onDocMousedown(e: MouseEvent) {
    const target = e.target as Node;
    if (inputRef.value?.contains(target)) return;
    // 检查是否点在 dropdown / mentionSlot overlay / 视角菜单 内
    const dropdown = document.querySelector('.webcut-mention-dropdown');
    const overlay = document.querySelector('.webcut-mention-slot-overlay');
    const viewMenu = document.querySelector('.webcut-mention-view-menu');
    if (overlay?.contains(target)) return;
    if (dropdown?.contains(target)) return;
    if (viewMenu?.contains(target)) return;
    showDropdown.value = false;
    replacingSegmentEl.value = null;
    openViewMenuState.value = null;
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

/** 暴露给父组件：读取当前所有 mention segments（含 external 角色/布景/道具），用于提交时同步上下文 */
defineExpose({
    getMentions: () => readSegmentsFromDom().filter((s) => s.kind === 'mention') as MentionSegment[],
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

        <!-- @ mentionSlot：Teleport to body，fixed 定位避免被 sidebar overflow 裁剪，实时计算位置防溢出 -->
        <Teleport to="body">
            <div
                v-if="showDropdown && mentionSlot && slotPos"
                class="webcut-mention-slot-overlay"
                :style="{ position: 'fixed', top: slotPos.top, bottom: slotPos.bottom, left: slotPos.left, maxWidth: slotPos.maxWidth, maxHeight: slotPos.maxHeight, zIndex: 20000 }"
                @mousedown.prevent
            >
                <component
                    :is="mentionSlot"
                    :resources="candidates"
                    :filter="dropdownFilter"
                    :active-index="slotActiveIndex"
                    :confirm="confirmSignal"
                    @select="onSlotSelect"
                    @count="(info: any) => { slotItemCount = info.total; slotColumnCounts = info.columns; }"
                    @close="showDropdown = false; slotPos = null"
                />
            </div>
        </Teleport>
        <!-- 默认 @ dropdown（无 mentionSlot 时） -->
        <div
            v-if="showDropdown && !mentionSlot && filteredCandidates.length"
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
                <span class="webcut-mention-dropdown-index">{{ item.external ? '@' + (item.name || '').slice(0, 6) : '@' + item.index }}</span>
                <span class="webcut-mention-dropdown-name">{{ item.name }}</span>
                <span class="webcut-mention-dropdown-type">{{ item.type }}</span>
            </button>
        </div>
        <!-- chip 视角切换菜单：Teleport to body -->
        <Teleport to="body">
            <div
                v-if="openViewMenuState"
                class="webcut-mention-view-menu"
                :style="{ position: 'fixed', top: (openViewMenuState.rect.bottom + 2) + 'px', left: openViewMenuState.rect.left + 'px', zIndex: 20100 }"
                @mousedown.prevent
            >
                <button
                    v-for="v in openViewMenuState.viewOptions"
                    :key="v.id"
                    type="button"
                    class="webcut-mention-view-item"
                    :class="{ active: v.id === openViewMenuState.selectedViewId }"
                    @click="applyViewToChip(openViewMenuState.chipEl, v)"
                >
                    <span class="webcut-mention-view-thumb">
                        <img v-if="v.url && v.mediaType !== 'audio'" :src="v.url" :alt="v.name" />
                        <svg v-else viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12V3.5l6-1v8.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="10.5" cy="11" r="1.5"/></svg>
                    </span>
                    <span class="webcut-mention-view-name">{{ v.name }}</span>
                </button>
            </div>
        </Teleport>
        <!-- 内置素材预览弹窗（chip icon 点击触发） -->
        <FilePreviewModal v-if="previewState" :type="previewState.type" :url="previewState.url" :name="previewState.name" @close="previewState = null" />
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
    width: 14px;
    height: 14px;
    border-radius: 3px;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
:deep(.webcut-mention-chip-icon img),
:deep(.webcut-mention-chip-icon video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
:deep(.webcut-mention-chip-icon:hover) { opacity: 1; }
:deep(.webcut-mention-chip-name) {
    cursor: pointer;
    text-decoration: none;
    text-underline-offset: 2px;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
:deep(.webcut-mention-chip:hover .webcut-mention-chip-name) {
    text-decoration: underline dotted;
}
:deep(.webcut-mention-chip-toggle) {
    border: none;
    background: transparent;
    color: inherit;
    padding: 0 2px;
    cursor: pointer;
    opacity: 0.5;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    border-radius: 3px;
}
:deep(.webcut-mention-chip-toggle:hover) { opacity: 1; background: rgba(0,0,0,0.08); }

/* chip 视角切换菜单 */
.webcut-mention-view-menu {
    min-width: 140px;
    max-width: 220px;
    background: var(--webcut-background-color, #fff);
    border: 1px solid var(--webcut-line-color, #eee);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    padding: 4px;
}
.webcut-mention-view-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: transparent;
    color: inherit;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.webcut-mention-view-item:hover { background: var(--webcut-grey-color, rgba(0,0,0,0.05)); }
.webcut-mention-view-item.active { background: var(--webcut-grey-color, rgba(0,0,0,0.08)); }
.webcut-mention-view-thumb {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--webcut-grey-color, #eee);
    display: flex;
    align-items: center;
    justify-content: center;
}
.webcut-mention-view-thumb img { width: 100%; height: 100%; object-fit: cover; }
.webcut-mention-view-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
.webcut-mention-slot-overlay {
    background: var(--webcut-background-color, #fff);
    border: 1px solid var(--webcut-line-color, #eee);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
    overflow: hidden;
}
</style>

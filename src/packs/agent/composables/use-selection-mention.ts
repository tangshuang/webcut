import { computed, ref, watch, type Ref } from 'vue';

export interface SelectedMaterial {
    index: number;          // 1-based 序号，作为 @N 引用值
    segmentId: string;
    railId: string;
    sourceKey: string;
    type: string;           // video/audio/image/text
    name: string;           // fileId / 文本前缀 / url
    text?: string;          // 文本片段内容
    startUs: number;
    endUs: number;
}

/**
 * 选中素材 + @ 引用组合式：messages-view 与 init 共用。
 * 从 runtime.ctx.selected 派生带序号的素材清单；提供 @mention 检测、下拉选择、移除（同步反选 + 清理文本）、提交时上下文拼接。
 *
 * 序号稳定性：维护独立的 sourceKey 顺序（append），不依赖 ctx.selected 内部顺序，
 * 避免编辑器选中机制导致序号跳变。
 */
export function useSelectionMention(runtime: any, text: Ref<string>) {
    // 维护稳定的 sourceKey 顺序（append：新选中追加到末尾，反选则移除，其余项保持不变）
    const sourceKeyOrder = ref<string[]>([]);

    // 监听选中项的 sourceKey 字符串变化（避免对 Map deep watch 导致报错）
    const selectedKeysStr = computed(() => {
        const ctx = runtime?.ctx;
        if (!ctx) return '';
        return (ctx.selected || []).map((s: any) => {
            const rail = (ctx.rails || []).find((r: any) => r.id === s.railId);
            const seg = rail?.segments?.find?.((sg: any) => sg.id === s.segmentId);
            return seg?.sourceKey || '';
        }).filter(Boolean).join('|');
    });

    watch(selectedKeysStr, (str) => {
        const currentKeys = str ? str.split('|') : [];
        sourceKeyOrder.value = sourceKeyOrder.value.filter(k => currentKeys.includes(k));
        for (const k of currentKeys) {
            if (!sourceKeyOrder.value.includes(k)) sourceKeyOrder.value.push(k);
        }
    }, { immediate: true });

    /** 当前选中的素材清单（按 sourceKeyOrder 稳定顺序，带 1-based 序号） */
    const selectedMaterials = computed<SelectedMaterial[]>(() => {
        const ctx = runtime?.ctx;
        if (!ctx) return [];
        const map = new Map<string, Omit<SelectedMaterial, 'index'>>();
        const selected = ctx.selected || [];
        for (const s of selected) {
            const rail = (ctx.rails || []).find((r: any) => r.id === s.railId);
            const segment = rail?.segments?.find?.((seg: any) => seg.id === s.segmentId);
            if (!segment?.sourceKey) continue;
            const source = ctx.sources?.get?.(segment.sourceKey);
            map.set(segment.sourceKey, {
                segmentId: s.segmentId,
                railId: s.railId,
                sourceKey: segment.sourceKey,
                type: source?.type || rail?.type || 'unknown',
                name: source?.fileId || (source?.text ? source.text.slice(0, 16) : source?.url) || segment?.id,
                text: source?.text,
                startUs: segment?.start || 0,
                endUs: segment?.end || 0,
            });
        }
        return sourceKeyOrder.value
            .map(k => map.get(k))
            .filter(Boolean)
            .map((m, i) => ({ ...m!, index: i + 1 })) as SelectedMaterial[];
    });

    // —— @mention 下拉 ——
    const mentionOpen = ref(false);
    const mentionQuery = ref('');
    let mentionAt = -1;
    let mentionCaret = 0;

    const mentionItems = computed(() => {
        const q = mentionQuery.value.trim();
        const list = selectedMaterials.value;
        return q ? list.filter(m => String(m.index).includes(q) || (m.name || '').toLowerCase().includes(q.toLowerCase())) : list;
    });

    function detectMention(textarea: HTMLTextAreaElement | HTMLDivElement | null) {
        if (!textarea) return;
        const val = typeof (textarea as HTMLTextAreaElement).value === 'string'
            ? (textarea as HTMLTextAreaElement).value
            : text.value;
        const caret = (textarea as HTMLTextAreaElement).selectionStart ?? val.length;
        mentionCaret = caret;
        const before = val.slice(0, caret);
        const m = before.match(/(?:^|\s)@([^\s]*)$/);
        if (m) {
            mentionQuery.value = m[1];
            mentionOpen.value = true;
            mentionAt = caret - m[0].length + (m[0].startsWith('\n') || m[0].startsWith(' ') ? 1 : 0);
        } else {
            mentionOpen.value = false;
            mentionAt = -1;
        }
    }

    function pickMention(item: { index: number; name: string; sourceKey?: string }) {
        if (mentionAt < 0) return;
        const val = text.value;
        const insert = `@${item.index} `;
        text.value = val.slice(0, mentionAt) + insert + val.slice(mentionCaret);
        mentionOpen.value = false;
        mentionAt = -1;
    }

    function closeMention() {
        mentionOpen.value = false;
        mentionAt = -1;
    }

    function removeMaterial(item: { segmentId: string; railId: string; sourceKey?: string }) {
        const re = new RegExp(`@${item.index}(\\s?)`, 'g');
        text.value = text.value.replace(re, '');
        try { runtime?.unselectSegment?.(item.segmentId, item.railId); } catch {}
    }

    function buildSubmitText(prompt: string): string {
        const selected = selectedMaterials.value;
        if (!selected.length) return prompt;
        const sel = selected.map(s => ({
            index: s.index, sourceKey: s.sourceKey, type: s.type,
            name: s.name, text: s.text, startUs: s.startUs, endUs: s.endUs,
        }));
        if (!sel.length) return prompt;
        const ann = '\n\n<user-focus>\n' + JSON.stringify(sel) + '\n</user-focus>';
        return prompt + ann;
    }

    return {
        selectedMaterials,
        mentionOpen,
        mentionQuery,
        mentionItems,
        detectMention,
        pickMention,
        closeMention,
        removeMaterial,
        buildSubmitText,
    };
}

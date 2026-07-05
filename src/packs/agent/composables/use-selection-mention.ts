import { computed, ref, type Ref } from 'vue';
import { useT } from '../../../i18n/hooks';

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
 */
export function useSelectionMention(runtime: any, text: Ref<string>) {
    const t = useT();

    /** 当前选中的素材清单（带 1-based 序号） */
    const selectedMaterials = computed<SelectedMaterial[]>(() => {
        const ctx = runtime?.ctx;
        if (!ctx) return [];
        const selected = ctx.selected || [];
        return selected.map((s: any) => {
            const rail = (ctx.rails || []).find((r: any) => r.id === s.railId);
            const segment = rail?.segments?.find?.((seg: any) => seg.id === s.segmentId);
            const source = segment ? ctx.sources?.get?.(segment.sourceKey) : null;
            return {
                segmentId: s.segmentId,
                railId: s.railId,
                sourceKey: segment?.sourceKey || '',
                type: source?.type || rail?.type || 'unknown',
                name: source?.fileId || (source?.text ? source.text.slice(0, 16) : source?.url) || segment?.id,
                text: source?.text,
                startUs: segment?.start || 0,
                endUs: segment?.end || 0,
            } as Omit<SelectedMaterial, 'index'>;
        }).filter((m: any) => m.sourceKey)
          .map((m: any, i: number) => ({ ...m, index: i + 1 }));
    });

    // —— @mention 下拉 ——
    const mentionOpen = ref(false);
    const mentionQuery = ref('');
    let mentionAt = -1;          // 当前激活 @ 在文本中的位置
    let mentionCaret = 0;        // 检测时的光标位置

    const mentionItems = computed(() => {
        const q = mentionQuery.value.trim().toLowerCase();
        const list = selectedMaterials.value;
        return (q ? list.filter((m) => String(m.index).includes(q) || (m.name || '').toLowerCase().includes(q) || (m.text || '').toLowerCase().includes(q)) : list).slice(0, 8);
    });

    /** 在输入事件中检测当前光标处是否有激活的 @mention */
    function detectMention(textarea: HTMLTextAreaElement | null) {
        if (!textarea) return;
        const val = textarea.value;
        const caret = textarea.selectionStart ?? val.length;
        mentionCaret = caret;
        const before = val.slice(0, caret);
        const atIdx = before.lastIndexOf('@');
        if (atIdx < 0) { mentionOpen.value = false; return; }
        if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) { mentionOpen.value = false; return; }
        const after = before.slice(atIdx + 1);
        if (/\s/.test(after)) { mentionOpen.value = false; return; }
        mentionAt = atIdx;
        mentionQuery.value = after;
        mentionOpen.value = true;
    }

    /** 选择某个 mention 项，把文本里的 @query 替换为 @index（带尾随空格） */
    function pickMention(item: SelectedMaterial, textarea?: HTMLTextAreaElement | null) {
        if (mentionAt < 0) return;
        const val = text.value;
        const before = val.slice(0, mentionAt);
        const insert = `@${item.index} `;
        const after = val.slice(mentionCaret);
        text.value = before + insert + after;
        mentionOpen.value = false;
        mentionAt = -1;
        // 把光标放到插入内容之后
        if (textarea) {
            const pos = before.length + insert.length;
            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(pos, pos);
            });
        }
    }

    /** 关闭 mention 下拉（失焦/ESC） */
    function closeMention() {
        mentionOpen.value = false;
        mentionAt = -1;
    }

    /** 移除一个选中素材：同步反选 + 清理文本里对它的 @N 引用 */
    function removeMaterial(item: SelectedMaterial) {
        // 1. 清理文本中的 @<index> 引用（含其后一个尾随空格）
        const re = new RegExp(`@${item.index}(\\s?)`, 'g');
        text.value = text.value.replace(re, '');
        // 2. 同步反选（与编辑器联动）
        try { runtime?.unselectSegment?.(item.segmentId, item.railId); } catch {}
    }

    /** 提交时把选中的素材 + 文本中实际引用的素材拼成上下文注解，附加到 prompt 末尾 */
    function buildSubmitText(prompt: string): string {
        const selected = selectedMaterials.value;
        if (!selected.length) return prompt;
        // 解析 prompt 中的 @N
        const referenced = new Set<number>();
        const re = /@(\d+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(prompt))) {
            referenced.add(Number(m[1]));
        }
        const sel = selected.map((s) => ({
            index: s.index, sourceKey: s.sourceKey, type: s.type,
            name: s.name, text: s.text, startUs: s.startUs, endUs: s.endUs,
        }));
        const ref = selected.filter((s) => referenced.has(s.index)).map((s) => ({
            index: s.index, sourceKey: s.sourceKey, type: s.type, text: s.text,
            name: s.name, startUs: s.startUs, endUs: s.endUs,
        }));
        if (!sel.length && !ref.length) return prompt;
        const ann = '\n\n<user-focus>\n选中的素材：\n' + JSON.stringify(sel, null, 2)
            + (ref.length ? '\n用户在消息中 @ 引用的素材：\n' + JSON.stringify(ref, null, 2) : '')
            + '\n</user-focus>';
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

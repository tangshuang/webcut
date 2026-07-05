import type { WebCutAgentToolRuntime } from './tools';
import { detectRatio, mimeToKind, ASPECT_RATIOS } from './tools-builtin/common';
import { transitionManager } from '../../modules/transitions';
import { filterManager } from '../../modules/filters';
import { animationManager } from '../../modules/animations';

const LIBRARY_TRUNCATE = 50;

/**
 * 构建一份紧凑的「当前剪辑器上下文」快照，作为 system 消息在每轮对话首轮注入。
 * 字段名带 Us 后缀的为微秒（1e6=1秒）。library 超过 50 项时截断 + total。
 */
export function buildContextSnapshot(runtime: WebCutAgentToolRuntime): Record<string, any> {
    const { ctx } = runtime;

    // 轨道 + 片段 + 转场
    const rails = (ctx.rails || []).map((rail: any) => ({
        id: rail.id,
        type: rail.type,
        main: !!rail.main,
        mute: !!rail.mute,
        hidden: !!rail.hidden,
        segments: (rail.segments || []).map((seg: any) => {
            const src = ctx.sources?.get?.(seg.sourceKey);
            return {
                sourceKey: seg.sourceKey,
                type: src?.type,
                name: src?.fileId || (src?.text ? src.text.slice(0, 24) : src?.url) || undefined,
                startUs: seg.start,
                endUs: seg.end,
            };
        }),
        transitions: (rail.transitions || []).map((tr: any) => ({
            id: tr.id, name: tr.name, startUs: tr.start, endUs: tr.end,
        })),
    }));

    // 媒体库（紧凑 + 截断）
    const libItems = (runtime.library.list() || []).map((m: any) => ({
        fileId: m.id,
        name: m.name,
        kind: mimeToKind(m.type),
        size: m.size,
    }));
    const library = libItems.length > LIBRARY_TRUNCATE
        ? { total: libItems.length, items: libItems.slice(0, LIBRARY_TRUNCATE), truncated: true }
        : libItems;

    // 当前选中
    const cur = ctx.current;
    const selection = cur ? { railId: cur.railId, segmentId: cur.segmentId, transitionId: cur.transitionId } : null;

    // 能力清单
    let transitions: string[] = [];
    let filters: string[] = [];
    const animations: Record<string, string[]> = { enter: [], exit: [], motion: [] };
    try { transitions = Object.keys(transitionManager.getTransitionDefaults() || {}); } catch {}
    try { filters = Object.keys(filterManager.getFilterDefaults() || {}); } catch {}
    try {
        const defs = animationManager.getAnimationDefaults() || {};
        for (const k of Object.keys(defs)) {
            const t = defs[k]?.type;
            if (t && animations[t]) animations[t].push(k);
        }
    } catch {}

    return {
        canvas: {
            width: ctx.width,
            height: ctx.height,
            aspectRatio: detectRatio(ctx.width, ctx.height),
            fps: ctx.fps,
            durationUs: ctx.duration,
        },
        player: {
            cursorUs: ctx.cursorTime,
            scale: ctx.scale,
            status: ctx.status,
            canUndo: ctx.canUndo,
            canRedo: ctx.canRedo,
        },
        rails,
        library,
        selection,
        capabilities: {
            aspectRatios: [...ASPECT_RATIOS],
            transitions,
            filters,
            animations,
        },
    };
}

/** 序列化为 LLM 友好的 system 消息内容（带标签包裹，便于 LLM 识别边界）。 */
export function formatContextMessage(snapshot: Record<string, any>): string {
    return '<webcut-context>\n' + JSON.stringify(snapshot, null, 2) + '\n</webcut-context>';
}

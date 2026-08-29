import type { WebCutAgentTool } from '../tools';
import { detectRatio, mimeToKind, ASPECT_RATIOS } from './common';
import { transitionManager } from '../../../modules/transitions';
import { filterManager } from '../../../modules/filters';
import { animationManager } from '../../../modules/animations';

/** 通用：序列化轨道 + 片段为紧凑结构（多处复用） */
export function summarizeRails(ctx: any) {
    return (ctx.rails || []).map((rail: any) => ({
        id: rail.id,
        type: rail.type,
        main: !!rail.main,
        mute: !!rail.mute,
        hidden: !!rail.hidden,
        locked: !!rail.locked,
        segments: (rail.segments || []).map((seg: any) => {
            const src = ctx.sources?.get?.(seg.sourceKey);
            return {
                id: seg.id,
                sourceKey: seg.sourceKey,
                type: src?.type,
                name: src?.fileId || src?.text?.slice?.(0, 24) || src?.url,
                startUs: seg.start,
                endUs: seg.end,
                durationUs: (seg.end || 0) - (seg.start || 0),
            };
        }),
        transitions: (rail.transitions || []).map((tr: any) => ({
            id: tr.id, name: tr.name, startUs: tr.start, endUs: tr.end,
        })),
    }));
}

/** 读取完整时间轴状态：画布、所有轨道、片段、转场、选中。修改前后都可调用来确认现状。 */
export const getTimelineState: WebCutAgentTool = {
    name: 'webcut_get_timeline_state',
    description: '读取当前剪辑器完整状态：画布尺寸/比例/帧率/总时长、所有轨道及其片段（含 sourceKey/时间区间/类型）、转场、当前选中。任何修改前若上下文过期，先调本工具。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        const { ctx } = runtime;
        const current = ctx.current;
        return {
            canvas: {
                width: ctx.width,
                height: ctx.height,
                aspectRatio: detectRatio(ctx.width, ctx.height),
                fps: ctx.fps,
                durationUs: ctx.duration,
            },
            rails: summarizeRails(ctx),
            selection: current ? { railId: current.railId, segmentId: current.segmentId, transitionId: current.transitionId } : null,
        };
    },
};

/** 读取播放器/视图状态：游标时间、缩放、播放状态、撤销可用性。 */
export const getPlayerState: WebCutAgentTool = {
    name: 'webcut_get_player_state',
    description: '读取播放器与时间轴视图状态：游标时间（cursorUs）、缩放（scale 0-100）、播放状态（status: -1 停止/0 暂停/1 播放）、总时长、可撤销/可重做。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        const { ctx } = runtime;
        return {
            cursorUs: ctx.cursorTime,
            scale: ctx.scale,
            status: ctx.status,
            durationUs: ctx.duration,
            fps: ctx.fps,
            canUndo: ctx.canUndo,
            canRedo: ctx.canRedo,
            canvasAspectRatio: detectRatio(ctx.width, ctx.height),
        };
    },
};

/** 列出当前项目媒体库的文件，用于挑选 add_media_from_library 的 fileId。 */
export const getLibrary: WebCutAgentTool = {
    name: 'webcut_get_library',
    description: '列出当前项目的媒体库文件（fileId、名称、媒体类型、大小）。要把媒体库素材放到时间轴时，先用本工具查 fileId，再调 webcut_add_media_from_library。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        const items = runtime.library.list() || [];
        return {
            total: items.length,
            files: items.map((m: any) => ({
                fileId: m.id,
                name: m.name,
                kind: mimeToKind(m.type),
                mime: m.type,
                size: m.size,
                tags: m.tags || [],
            })),
        };
    },
};

/** 读取当前选中的 segment/source 详情（meta/样式/动画/音视频属性）。 */
export const getSelection: WebCutAgentTool = {
    name: 'webcut_get_selection',
    description: '读取当前选中片段（sourceKey）的详情：类型、文本内容、rect（位置/尺寸/角度）、opacity、动画、音量、播放速率、滤镜、时间偏移。修改属性前调本工具看清现状。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        const { ctx } = runtime;
        const cur = ctx.current;
        if (!cur || !cur.segmentId) return { selection: null };
        const rail = (ctx.rails || []).find((r: any) => r.id === cur.railId);
        const segment = rail?.segments?.find?.((s: any) => s.id === cur.segmentId);
        const source = segment ? ctx.sources?.get?.(segment.sourceKey) : null;
        return {
            selection: {
                railId: cur.railId,
                segmentId: cur.segmentId,
                sourceKey: segment?.sourceKey,
                startUs: segment?.start,
                endUs: segment?.end,
                source: source
                    ? {
                          type: source.type,
                          text: source.text,
                          fileId: source.fileId,
                          meta: pruneMeta(source.meta),
                      }
                    : null,
            },
        };
    },
};

/** 列出可用的转场、滤镜、动画清单（名称 + 默认参数），便于选 name。 */
export const listEffects: WebCutAgentTool = {
    name: 'webcut_list_effects',
    description: '列出所有可用的转场（transitions）、滤镜（filters）、动画（animations，按 enter/exit/motion 分组）名称与默认参数。选 apply_transition/apply_animation 的 name 前可调本工具。',
    parameters: { type: 'object', properties: {} },
    execute() {
        let transitions: any = null;
        let filters: any = null;
        let animations: any = null;
        try { transitions = transitionManager?.getTransitionDefaults?.(); } catch {}
        try { filters = filterManager?.getFilterDefaults?.(); } catch {}
        try { animations = animationManager?.getAnimationDefaults?.(); } catch {}
        const animGrouped: Record<string, string[]> = { enter: [], exit: [], motion: [] };
        if (animations) {
            for (const k of Object.keys(animations)) {
                const t = animations[k]?.type;
                if (t && animGrouped[t]) animGrouped[t].push(k);
            }
        }
        return {
            aspectRatios: [...ASPECT_RATIOS],
            transitions: transitions ? Object.keys(transitions) : [],
            filters: filters ? Object.keys(filters) : [],
            animations: animGrouped,
        };
    },
};

/** 列出历史记录，便于 recover_to_history。 */
export const listHistory: WebCutAgentTool = {
    name: 'webcut_list_history',
    description: '列出可撤销/重做的历史记录条目（id、标题、时间）。需要跳转到某个历史点时调 webcut_recover_to_history。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        const list = runtime.history.list() || [];
        return {
            canUndo: runtime.ctx.canUndo,
            canRedo: runtime.ctx.canRedo,
            items: list.map((h: any) => ({ id: h.id, title: h.title, time: h.time })),
        };
    },
};

export const queryTools: WebCutAgentTool[] = [
    getTimelineState,
    getPlayerState,
    getLibrary,
    getSelection,
    listEffects,
    listHistory,
];

// —— 内部辅助 ——
function pruneMeta(meta: any) {
    if (!meta) return null;
    return {
        rect: meta.rect,
        opacity: meta.opacity,
        flip: meta.flip,
        zIndex: meta.zIndex,
        time: meta.time,
        audio: meta.audio,
        video: meta.video,
        text: meta.text ? { css: meta.text.css } : undefined,
        animation: meta.animation ? { name: meta.animation.name, type: meta.animation.type, params: meta.animation.params } : undefined,
        filters: meta.filters,
    };
}

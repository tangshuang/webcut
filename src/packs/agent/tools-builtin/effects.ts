import type { WebCutAgentTool } from '../tools';
import { REFRESH_HINT } from './common';

/** 应用动画（enter/exit/motion 三类，name 见 list_effects） */
export const applyAnimation: WebCutAgentTool<{ sourceKey: string; type: 'enter' | 'exit' | 'motion'; name: string; durationUs?: number; delayUs?: number; iterCount?: number }> = {
    name: 'webcut.apply_animation',
    description: '给片段应用动画。type=enter(入场)/exit(出场)/motion(循环运动)；name 取自 webcut.list_effects 的 animations（如 fadeIn/slideInLeft/pulse/shake）。durationUs/delayUs 单位微秒；iterCount 0=无限（仅 motion）。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string' },
            type: { type: 'string', enum: ['enter', 'exit', 'motion'] },
            name: { type: 'string', description: '动画名（来自 list_effects）' },
            durationUs: { type: 'number', description: '时长（微秒），不传用默认' },
            delayUs: { type: 'number', description: '延迟（微秒），默认 0' },
            iterCount: { type: 'number', description: '重复次数，0=无限（仅 motion）' },
        },
        required: ['sourceKey', 'type', 'name'],
    },
    async execute(runtime, input) {
        await runtime.applyAnimation(input.sourceKey, {
            type: input.type,
            name: input.name,
            params: {
                duration: input.durationUs,
                delay: input.delayUs || 0,
                iterCount: input.iterCount,
            },
        });
        return { ok: true };
    },
};

/** 清除片段动画 */
export const removeAnimation: WebCutAgentTool<{ sourceKey: string }> = {
    name: 'webcut.remove_animation',
    description: '清除指定片段的动画，恢复初始状态。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { sourceKey: { type: 'string' } },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        await runtime.applyAnimation(input.sourceKey, null);
        return { ok: true };
    },
};

/** 在两个相邻片段之间添加转场（需先把播放头移到两段衔接处） */
export const applyTransition: WebCutAgentTool<{ railId: string; name: string; durationUs?: number }> = {
    name: 'webcut.apply_transition',
    description: '在指定轨道上、当前播放头所在的两个相邻片段之间添加转场。name 取自 webcut.list_effects 的 transitions（fade/slide/zoom/blinds/dissolve）。先调 webcut.seek_cursor 把播放头移到两段衔接处。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            railId: { type: 'string', description: '目标轨道 id' },
            name: { type: 'string', description: '转场名' },
            durationUs: { type: 'number', description: '转场时长（微秒），不传用默认' },
        },
        required: ['railId', 'name'],
    },
    async execute(runtime, input) {
        const rail = runtime.findRail(input.railId);
        if (!rail) return { ok: false, error: '找不到 railId' };
        const cursor = runtime.ctx.cursorTime;
        const duration = input.durationUs || 1000000;
        const transition = {
            id: 'tr_' + Math.random().toString(36).slice(2),
            name: input.name,
            start: cursor - Math.floor(duration / 2),
            end: cursor + Math.ceil(duration / 2),
        };
        await runtime.applyTransition(rail, transition);
        return { ok: true, transitionId: transition.id, startUs: transition.start, endUs: transition.end };
    },
};

/** 移除转场 */
export const removeTransition: WebCutAgentTool<{ railId: string; transitionId: string }> = {
    name: 'webcut.remove_transition',
    description: '移除指定轨道上的某个转场（按 transitionId）。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            railId: { type: 'string' },
            transitionId: { type: 'string' },
        },
        required: ['railId', 'transitionId'],
    },
    execute(runtime, input) {
        const rail = runtime.findRail(input.railId);
        if (!rail) return { ok: false, error: '找不到 railId' };
        runtime.removeTransition(rail, input.transitionId);
        return { ok: true };
    },
};

/** 视频分离音频（拆为无声视频 + 新建对齐音频轨） */
export const separateAudio: WebCutAgentTool<{ sourceKey: string }> = {
    name: 'webcut.separate_audio',
    description: '把视频片段拆为：无声视频（替换原片段）+ 新建音频轨道放对齐的音频片段。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { sourceKey: { type: 'string' } },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        await runtime.separateAudioFromVideo(input.sourceKey);
        return { ok: true };
    },
};

/** 修复变速后的音调 */
export const repairPitch: WebCutAgentTool<{ sourceKey: string }> = {
    name: 'webcut.repair_pitch',
    description: '当片段设置了 playbackRate≠1 后，用 ffmpeg atempo 修复音调（保持变速但不变调）。按片段类型自动选音频/视频处理。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { sourceKey: { type: 'string' } },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        await runtime.repairPitch(input.sourceKey);
        return { ok: true };
    },
};

export const effectTools: WebCutAgentTool[] = [
    applyAnimation,
    removeAnimation,
    applyTransition,
    removeTransition,
    separateAudio,
    repairPitch,
];

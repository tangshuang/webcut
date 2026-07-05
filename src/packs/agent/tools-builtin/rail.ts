import type { WebCutAgentTool } from '../tools';
import { ASPECT_RATIOS, REFRESH_HINT } from './common';

/** 切换轨道静音 */
export const setRailMute: WebCutAgentTool<{ railId: string; mute: boolean }> = {
    name: 'webcut.set_rail_mute',
    description: '设置轨道静音状态（mute=true 静音 / false 取消静音）。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { railId: { type: 'string' }, mute: { type: 'boolean' } },
        required: ['railId', 'mute'],
    },
    execute(runtime, input) {
        const rail = runtime.findRail(input.railId);
        if (!rail) return { ok: false, error: '找不到 railId' };
        runtime.toggleRailMute(rail, input.mute);
        return { ok: true };
    },
};

/** 切换轨道显隐 */
export const setRailHidden: WebCutAgentTool<{ railId: string; hidden: boolean }> = {
    name: 'webcut.set_rail_hidden',
    description: '设置轨道显隐（hidden=true 隐藏 / false 显示）。隐藏后片段仍存在于时间轴但不渲染。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { railId: { type: 'string' }, hidden: { type: 'boolean' } },
        required: ['railId', 'hidden'],
    },
    execute(runtime, input) {
        const rail = runtime.findRail(input.railId);
        if (!rail) return { ok: false, error: '找不到 railId' };
        if (rail.hidden !== input.hidden) runtime.toggleRailHidden(rail);
        return { ok: true };
    },
};

/** 主视频磁吸（消除主轨 segment 之间间隙） */
export const magnetMainVideo: WebCutAgentTool<{ railId?: string }> = {
    name: 'webcut.magnet_main_video',
    description: '对主视频轨道做磁吸：按顺序消除相邻片段之间的时间间隙，让片段紧挨。不传 railId 则对主视频轨(main=true)生效。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: { railId: { type: 'string' } },
    },
    execute(runtime, input) {
        const rail = input.railId ? runtime.findRail(input.railId) : undefined;
        runtime.applyMainVideoMagnet(rail);
        return { ok: true };
    },
};

/** 切换画幅比例 */
export const setAspectRatio: WebCutAgentTool<{ ratio: string }> = {
    name: 'webcut.set_aspect_ratio',
    description: '切换画布长宽比（同步调整画布宽高，已有片段按比例适配）。',
    parameters: {
        type: 'object',
        properties: { ratio: { type: 'string', enum: [...ASPECT_RATIOS] } },
        required: ['ratio'],
    },
    async execute(runtime, input) {
        await runtime.updateByAspectRatio(input.ratio);
        return { ok: true, ratio: input.ratio };
    },
};

export const railTools: WebCutAgentTool[] = [setRailMute, setRailHidden, magnetMainVideo, setAspectRatio];

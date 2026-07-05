import type { WebCutAgentTool } from '../tools';

/** 把播放头跳到指定时间（微秒） */
export const seekCursor: WebCutAgentTool<{ time: number }> = {
    name: 'webcut.seek_cursor',
    description: '把播放头跳到指定时间（微秒，1e6=1秒）。定位播放头后再做拆分/加转场等位置相关操作。',
    parameters: {
        type: 'object',
        properties: { time: { type: 'number', description: '目标时间（微秒）' } },
        required: ['time'],
    },
    execute(runtime, input) {
        runtime.seekCursor(input.time);
        return { ok: true, cursorUs: input.time };
    },
};

/** 设置时间轴缩放 */
export const setScale: WebCutAgentTool<{ scale: number }> = {
    name: 'webcut.set_scale',
    description: '设置时间轴缩放比例（0-100，步进 10；越大越展开）。仅影响视图，不影响片段。',
    parameters: {
        type: 'object',
        properties: { scale: { type: 'number', description: '0-100，建议 10 的倍数' } },
        required: ['scale'],
    },
    execute(runtime, input) {
        const s = Math.max(0, Math.min(100, Math.round(input.scale / 10) * 10));
        runtime.setScale(s);
        return { ok: true, scale: s };
    },
};

export const play: WebCutAgentTool = {
    name: 'webcut.play',
    description: '从当前播放头开始播放。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) { runtime.play(); return { ok: true }; },
};

export const pause: WebCutAgentTool = {
    name: 'webcut.pause',
    description: '暂停播放。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) { runtime.pause(); return { ok: true }; },
};

export const reset: WebCutAgentTool = {
    name: 'webcut.reset',
    description: '停止播放并把播放头重置到 0。',
    parameters: { type: 'object', properties: {} },
    async execute(runtime) { await runtime.reset(); return { ok: true }; },
};

export const viewTools: WebCutAgentTool[] = [seekCursor, setScale, play, pause, reset];

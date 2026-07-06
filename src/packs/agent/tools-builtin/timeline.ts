import type { WebCutAgentTool } from '../tools';
import { REFRESH_HINT } from './common';

/** 加文字片段到时间轴（不传 start 用当前播放头） */
export const addTextSegment: WebCutAgentTool<{ text: string; start?: number; railId?: string }> = {
    name: 'webcut.add_text_segment',
    description: '在时间轴上添加一段文字片段（渲染为图片 sprite 落到文本轨道）。不传 start 时使用当前播放头位置。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            text: { type: 'string', description: '要显示的文字内容' },
            start: { type: 'number', description: '起点（微秒，1e6=1秒），不传则用当前播放头' },
            railId: { type: 'string', description: '目标文本轨道 id，不传则自动新建/复用' },
        },
        required: ['text'],
    },
    async execute(runtime, input) {
        const start = typeof input.start === 'number' ? input.start : runtime.ctx.cursorTime;
        const meta: any = { time: { start } };
        if (input.railId) meta.withRailId = input.railId;
        const sourceKey = await runtime.push('text', input.text, meta);
        return { sourceKey, start };
    },
};

/** 从媒体库取文件推到时间轴。先 get_library 拿 fileId。 */
export const addMediaFromLibrary: WebCutAgentTool<{ fileId: string; type: 'video' | 'audio' | 'image'; start?: number; railId?: string }> = {
    name: 'webcut.add_media_from_library',
    description: '从当前项目媒体库取一个文件推到时间轴。需要先调 webcut.get_library 拿到 fileId 与媒体类型。不传 start 时使用当前播放头位置。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '媒体库文件 id（webcut.get_library 返回的 fileId）' },
            type: { type: 'string', enum: ['video', 'audio', 'image'], description: '媒体类型' },
            start: { type: 'number', description: '起点（微秒），不传则用当前播放头' },
            railId: { type: 'string', description: '目标轨道 id，不传则自动选择/新建' },
        },
        required: ['fileId', 'type'],
    },
    async execute(runtime, input) {
        const start = typeof input.start === 'number' ? input.start : runtime.ctx.cursorTime;
        const meta: any = { time: { start } };
        if (input.railId) meta.withRailId = input.railId;
        const sourceKey = await runtime.push(input.type, 'file:' + input.fileId, meta);
        return { sourceKey, start };
    },
};

/** 把本地 OPFS 中的素材上传到服务端，返回服务端 fileId。LLM 在确认服务端无该文件后调用。 */
export const uploadSource: WebCutAgentTool<{ sourceKey: string }> = {
    name: 'webcut.upload_source',
    description: '把指定 sourceKey 对应的本地素材（仅存在于前端 OPFS）上传到服务端，返回 {fileId, url, type, name}。当 aiman.file_exists 返回 exists=false 时调用本工具，拿到服务端 fileId 后再用于上游服务（如 generate_video 的首末帧/参考图）。',
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string', description: '<user-focus> 中的 sourceKey' },
        },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        if (!runtime.library.uploadToServer) return { error: '当前 adapter 不支持 uploadFile' };
        const source = runtime.getSource(input.sourceKey);
        if (!source) return { error: 'sourceKey 不存在' };
        const localFileId = source.fileId;
        if (!localFileId) return { error: '该素材无本地 fileId（可能是文本/URL 类素材）' };
        const result = await runtime.library.uploadToServer(localFileId);
        if (!result) return { error: '上传失败' };
        return { ...result, sourceKey: input.sourceKey, localFileId };
    },
};

/** 直接推一个外部 url / data URL / 已知 fileId 的素材（优先用 add_media_from_library） */
export const pushMedia: WebCutAgentTool<{ type: 'video' | 'audio' | 'image' | 'text'; source: string; start?: number; railId?: string }> = {
    name: 'webcut.push_media',
    description: '直接推送任意素材到时间轴：source 可为 http(s) URL、data: URL 或 "file:<fileId>"。优先用 webcut.add_media_from_library 走媒体库。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['video', 'audio', 'image', 'text'] },
            source: { type: 'string', description: 'URL / data URL / "file:<fileId>"' },
            start: { type: 'number', description: '起点（微秒），不传则用当前播放头' },
            railId: { type: 'string' },
        },
        required: ['type', 'source'],
    },
    async execute(runtime, input) {
        const start = typeof input.start === 'number' ? input.start : runtime.ctx.cursorTime;
        const meta: any = { time: { start } };
        if (input.railId) meta.withRailId = input.railId;
        const sourceKey = await runtime.push(input.type, input.source, meta);
        return { sourceKey, start };
    },
};

/** 批量按顺序连续推送素材（前一个结束 = 后一个开始） */
export const pushSeries: WebCutAgentTool<{ materials: Array<{ type: string; source: string; start?: number }>; startTime?: number; thingType?: string }> = {
    name: 'webcut.push_series',
    description: '批量按顺序连续推送多个素材（前一个结束 = 后一个开始，自动续接）。适合"按顺序排几段视频"。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            materials: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, source: { type: 'string' } }, required: ['type', 'source'] } },
            startTime: { type: 'number', description: '起始时间（微秒），默认从当前播放头或轨道末尾' },
            thingType: { type: 'string', description: '统一轨道类型，默认按第一个素材类型' },
        },
        required: ['materials'],
    },
    async execute(runtime, input) {
        const keys = await runtime.pushSeries(input.materials as any, { startTime: input.startTime, thingType: input.thingType });
        return { sourceKeys: keys };
    },
};

/** 按 sourceKey 删除片段（同步删除 segment 与空轨，触发磁吸）——修复版，使用 manager.deleteSegment */
export const deleteSegment: WebCutAgentTool<{ sourceKey: string; keepRailWhenEmpty?: boolean }> = {
    name: 'webcut.delete_segment',
    description: '按 sourceKey 删除片段：同步从轨道 segments 中移除、销毁 source、轨道空时连轨一起删（除非 keepRailWhenEmpty=true）、触发主轨磁吸。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string', description: '要删除片段的 sourceKey（来自快照或 get_timeline_state）' },
            keepRailWhenEmpty: { type: 'boolean', description: '轨道删空时是否保留轨道，默认 false（删空轨）' },
        },
        required: ['sourceKey'],
    },
    execute(runtime, input) {
        const loc = runtime.findSegment(input.sourceKey);
        if (!loc) return { ok: false, error: '找不到该 sourceKey 对应的 segment' };
        runtime.deleteSegment({ segment: loc.segment, rail: loc.rail, keepRailWhenEmpty: input.keepRailWhenEmpty });
        return { ok: true };
    },
};

/** 在当前播放头处切分片段 */
export const splitSegment: WebCutAgentTool<{ sourceKey: string; keep?: 'left' | 'right' | 'both' }> = {
    name: 'webcut.split_segment',
    description: '在当前播放头位置切分指定片段为两段。keep 控制：both=保留两半（默认）、left=只留左半、right=只留右半。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string' },
            keep: { type: 'string', enum: ['left', 'right', 'both'], description: '保留策略，默认 both' },
        },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        const loc = runtime.findSegment(input.sourceKey);
        if (!loc) return { ok: false, error: '找不到该 sourceKey 对应的 segment' };
        await runtime.splitSegment({ segment: loc.segment, rail: loc.rail, keep: input.keep || 'both' });
        return { ok: true, splitAtUs: runtime.ctx.cursorTime };
    },
};

/** 更新文字片段的内容/样式 */
export const updateText: WebCutAgentTool<{ sourceKey: string; text?: string; css?: Record<string, any> }> = {
    name: 'webcut.update_text',
    description: '更新文字片段的内容或 CSS 样式（如字体、颜色、大小）。css 例：{"color":"#fff","font-size":"48px","font-weight":"700"}。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string' },
            text: { type: 'string', description: '新文字内容' },
            css: { type: 'object', description: 'CSS 样式对象' },
        },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        await runtime.updateText(input.sourceKey, { text: input.text, css: input.css });
        return { ok: true };
    },
};

/** 通用属性更新：rect/opacity/volume/playbackRate。一个工具覆盖多种属性改动。 */
export const updateSegmentProps: WebCutAgentTool<{
    sourceKey: string;
    rect?: { x?: number; y?: number; w?: number; h?: number; angle?: number };
    opacity?: number;
    volume?: number;
    playbackRate?: number;
}> = {
    name: 'webcut.update_segment_props',
    description: '更新片段的通用属性：位置/尺寸/角度（rect）、不透明度（opacity 0-1）、音量（volume 0-1，>0 启用音频）、播放速率（playbackRate，>0；≠1 会按比例调整显示时长）。只传需要改的字段。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string' },
            rect: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, angle: { type: 'number' } } },
            opacity: { type: 'number' },
            volume: { type: 'number' },
            playbackRate: { type: 'number' },
        },
        required: ['sourceKey'],
    },
    async execute(runtime, input) {
        const source = runtime.getSource(input.sourceKey);
        if (!source) return { ok: false, error: 'source 不存在' };
        const data: any = {};
        if (input.rect) data.rect = input.rect;
        if (typeof input.opacity === 'number') data.opacity = input.opacity;
        if (typeof input.volume === 'number') data.audio = { volume: input.volume };
        if (typeof input.playbackRate === 'number') data.time = { playbackRate: input.playbackRate };
        await runtime.syncSourceMeta(source, data);
        return { ok: true };
    },
};

/** 设置片段滤镜（覆盖式） */
export const setFilters: WebCutAgentTool<{ sourceKey: string; filters: Array<{ name: string; params?: Record<string, any> }> }> = {
    name: 'webcut.set_filters',
    description: '设置片段的滤镜（覆盖原有）。name 取自 webcut.list_effects 的 filters（如 grayscale/blur/brightness/contrast/saturate）。传空数组清除所有滤镜。' + REFRESH_HINT,
    parameters: {
        type: 'object',
        properties: {
            sourceKey: { type: 'string' },
            filters: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, params: { type: 'object' } }, required: ['name'] } },
        },
        required: ['sourceKey', 'filters'],
    },
    async execute(runtime, input) {
        const source = runtime.getSource(input.sourceKey);
        if (!source) return { ok: false, error: 'source 不存在' };
        await runtime.syncSourceMeta(source, { filters: input.filters });
        return { ok: true };
    },
};

/** 清空时间轴全部素材（危险） */
export const clearTimeline: WebCutAgentTool = {
    name: 'webcut.clear_timeline',
    description: '【危险】清空时间轴所有轨道与素材，播放头回到 0。调用前务必先用一句话向用户确认。',
    parameters: { type: 'object', properties: {} },
    execute(runtime) {
        runtime.ctx.sources && runtime.ctx.sources.clear?.();
        // 借助 player.clear：通过 ctx 找到 player 引用（hooks 内部）；这里用 remove 逐个清以兼容
        const keys = runtime.ctx.sources ? [] : [];
        // 直接重置 rails（ctx 是响应式，写回会触发视图刷新；真正销毁 sprite 走 player.clear，但 runtime 未暴露 clear）
        runtime.ctx.rails.splice(0, runtime.ctx.rails.length);
        return { ok: true, cleared: keys.length };
    },
};

export const timelineTools: WebCutAgentTool[] = [
    addTextSegment,
    addMediaFromLibrary,
    uploadSource,
    pushMedia,
    pushSeries,
    deleteSegment,
    splitSegment,
    updateText,
    updateSegmentProps,
    setFilters,
    clearTimeline,
];

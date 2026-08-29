import type { WebCutAgentTool } from '../tools';

/** 导出整段时间轴为视频 */
export const exportVideo: WebCutAgentTool = {
    name: 'webcut_export_video',
    description: '把当前整段时间轴渲染导出为 video/mp4。返回导出状态。导出耗时取决于时间轴长度，调用方前端会拿到 Blob。',
    parameters: { type: 'object', properties: {} },
    async execute(runtime) {
        const blob = await runtime.exportBlob();
        return { ok: true, size: blob?.size || 0, mime: blob?.type || 'video/mp4' };
    },
};

export const exportTools: WebCutAgentTool[] = [exportVideo];

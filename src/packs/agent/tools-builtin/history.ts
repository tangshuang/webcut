import type { WebCutAgentTool } from '../tools';
import { REFRESH_HINT } from './common';

export const undo: WebCutAgentTool = {
    name: 'webcut_undo',
    description: '撤销上一步操作。agent 出错时可用本工具自纠。' + REFRESH_HINT,
    parameters: { type: 'object', properties: {} },
    async execute(runtime) { await runtime.history.undo(); return { ok: true, canUndo: runtime.ctx.canUndo }; },
};

export const redo: WebCutAgentTool = {
    name: 'webcut_redo',
    description: '重做（恢复被撤销的操作）。' + REFRESH_HINT,
    parameters: { type: 'object', properties: {} },
    async execute(runtime) { await runtime.history.redo(); return { ok: true, canRedo: runtime.ctx.canRedo }; },
};

export const recoverToHistory: WebCutAgentTool<{ historyId: string }> = {
    name: 'webcut_recover_to_history',
    description: '恢复到指定的历史节点（按 historyId，来自 webcut_list_history）。可跨越多步回溯。',
    parameters: {
        type: 'object',
        properties: { historyId: { type: 'string' } },
        required: ['historyId'],
    },
    async execute(runtime, input) {
        await runtime.history.recoverToHistory(input.historyId);
        return { ok: true };
    },
};

export const historyTools: WebCutAgentTool[] = [undo, redo, recoverToHistory];

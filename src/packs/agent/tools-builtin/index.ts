import type { WebCutAgentTool } from '../tools';
import { queryTools } from './query';
import { timelineTools } from './timeline';
import { effectTools } from './effects';
import { railTools } from './rail';
import { viewTools } from './view';
import { historyTools } from './history';
import { exportTools } from './export';

/**
 * 内置 webcut 编辑工具集合（前端驻留执行）。
 * 按 schema（喂 LLM）+ executor（操作剪辑器）同源，统一 webcut.* 命名前缀。
 */
export function createBuiltinTools(): WebCutAgentTool[] {
    return [
        ...queryTools,
        ...timelineTools,
        ...effectTools,
        ...railTools,
        ...viewTools,
        ...historyTools,
        ...exportTools,
    ];
}

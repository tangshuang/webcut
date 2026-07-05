import type { WebCutContext } from '../../types';
import type { WebCutAgentToolSchema } from './adapter';

/**
 * agent 工具运行时：把剪辑器上下文与各 hook 操作暴露给工具执行器。
 * 由 sidebar 在 setup 时由 useWebCutPlayer/Manager/Library/History/Transition 组装，
 * 注入每次 execute 调用。按职责分组，工具按需取用。
 */
export interface WebCutAgentToolRuntime {
    /** 响应式剪辑器上下文（rails/sources/cursorTime/width/height/duration/scale/...） */
    ctx: WebCutContext;

    // —— 查询辅助 ——
    /** 按 sourceKey 取 source 对象（含 meta/sprite/clip） */
    getSource(sourceKey: string): any | null;
    /** 按 sourceKey 定位 { rail, segment }；找不到返回 null */
    findSegment(sourceKey: string): { rail: any; segment: any } | null;
    /** 按 railId 取 rail 对象 */
    findRail(railId: string): any | null;

    // —— player（素材/播放） ——
    /** 推送素材到时间轴，返回 sourceKey。source 可为 'file:<fileId>' / 'data:' / URL / File */
    push(type: 'video' | 'audio' | 'image' | 'text', source: string | File, meta?: any): Promise<string>;
    /** 批量按顺序连续推送（前一个结束 = 后一个开始） */
    pushSeries(materials: Array<{ type: string; source: string | File; meta?: any }>, options?: { startTime?: number; thingType?: string }): Promise<string[]>;
    /** 按 sourceKey 低层移除（不删 segment；优先用 deleteSegment） */
    remove(sourceKey: string): void;
    /** 更新文本素材内容/样式 */
    updateText(sourceKey: string, data: { text?: string; css?: Record<string, any> }): Promise<void>;
    /** 应用/清除动画 */
    applyAnimation(sourceKey: string, data: any): Promise<any>;
    /** 同步素材 meta（rect/opacity/filters/animation/audio/video/time） */
    syncSourceMeta(source: any, data: any): Promise<void>;
    /** 视频拆为无声视频 + 新建对齐音频轨 */
    separateAudioFromVideo(sourceKey: string): Promise<void>;
    /** 修复变速后的音调（按 source.type 选 audio/video） */
    repairPitch(sourceKey: string): Promise<void>;
    play(): void;
    pause(): void;
    reset(): Promise<void>;
    exportBlob(): Promise<Blob>;

    // —— manager（时间轴编辑） ——
    /** 删除 segment 及其 source；轨空时连轨一起删（除非 keepRailWhenEmpty）；可触发磁吸 */
    deleteSegment(args: { segment: any; rail: any; skipMagnet?: boolean; keepRailWhenEmpty?: boolean }): void;
    /** 在当前游标处切分 segment。keep: 'left'|'right'|'both' */
    splitSegment(args: { segment: any; rail: any; keep?: 'left' | 'right' | 'both' }): Promise<void>;
    /** 切换轨道静音 */
    toggleRailMute(rail: any, mute?: boolean): void;
    /** 切换轨道显隐 */
    toggleRailHidden(rail: any): void;
    /** 主视频磁吸：消除主轨 segment 之间间隙 */
    applyMainVideoMagnet(rail?: any): void;

    // —— transition ——
    /** 在两段相邻 segment 之间创建转场 */
    applyTransition(rail: any, transition: any): Promise<void>;
    /** 移除转场 */
    removeTransition(rail: any, transitionId: string): void;

    // —— library（媒体库） ——
    library: {
        /** 当前项目文件列表（WebCutMaterial[]） */
        list(): any[];
        /** 把 File 加入媒体库与当前项目 */
        addNewFile(file: File, tags?: string[]): Promise<void>;
    };

    // —— history（撤销/重做） ——
    history: {
        /** 推一次历史快照（无变化返回 null） */
        push(options?: { title?: string }): Promise<string | null>;
        undo(): Promise<void>;
        redo(): Promise<void>;
        /** 历史记录列表 */
        list(): any[];
        recoverToHistory(historyId: string): Promise<void>;
    };

    // —— 全局 ——
    /** 切换画幅比例（21:9 / 16:9 / 4:3 / 9:16 / 3:4 / 1:1） */
    updateByAspectRatio(ratio: string): Promise<void>;
    /** 把播放头跳到指定时间（微秒） */
    seekCursor(timeMicroseconds: number): void;
    /** 设置时间轴缩放 [0,100]，步进 10 */
    setScale(scale: number): void;

    // —— 选中（与编辑器多选联动）——
    /** 取消选中某个 segment（与编辑器选中状态双向同步） */
    unselectSegment(segmentId: string, railId: string): void;
    /** 清空所有选中 */
    clearSelection(): void;
}

/**
 * agent 工具：同时是 schema（喂给 LLM）+ 前端驻留执行器，单一信息源。
 */
export interface WebCutAgentTool<I = any, R = any> {
    /** 全局唯一，建议命名空间前缀，如 webcut.add_text_segment */
    name: string;
    /** 给 LLM 的工具说明 */
    description: string;
    /** JSON schema */
    parameters: object;
    /** 前端执行器：对剪辑器执行真实操作 */
    execute(runtime: WebCutAgentToolRuntime, input: I): Promise<R> | R;
}

export interface WebCutAgentToolRegistry {
    get(name: string): WebCutAgentTool | undefined;
    has(name: string): boolean;
    schemas(): WebCutAgentToolSchema[];
    list(): WebCutAgentTool[];
}

/**
 * 合并内置工具 + 调用方注入工具，按 name 去重（注入不得覆盖内置同名）。
 */
export function createToolRegistry(
    builtin: WebCutAgentTool[],
    injected: WebCutAgentTool[] = [],
): WebCutAgentToolRegistry {
    const map = new Map<string, WebCutAgentTool>();
    for (const t of builtin) {
        map.set(t.name, t);
    }
    for (const t of injected) {
        if (!map.has(t.name)) {
            map.set(t.name, t);
        }
    }
    const list = [...map.values()];
    return {
        get: (name) => map.get(name),
        has: (name) => map.has(name),
        schemas: () => list.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
        list: () => list,
    };
}

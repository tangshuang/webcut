import { WebCutProjectHistoryData, WebCutProjectHistoryPushPayload, WebCutProjectHistoryState } from '../types';
import {
    pushProjectHistoryEntry,
    updateProjectHistoryEntry,
    getProjectHistory,
    clearProjectHistory,
    moveProjectHistoryTo,
    moveProjectHistoryToId,
    getProjectState,
    getProjectHistorySnapshot,
} from '../db';
import { aspectRatioMap } from '../constants';

/** 历史记录对应的完整项目状态 */
export type WebCutHistorySavedState = {
    aspectRatio: keyof typeof aspectRatioMap,
    state: WebCutProjectHistoryState,
};

// 历史记录管理器类
export class HistoryMachine {
    private currentHistoryId: string | null = null;
    private currentHistoryData: WebCutProjectHistoryData | null = null;
    private currentIndex: number = -1;
    private historyLength: number = 0;

    private projectId: string;
    private isInitializing: boolean = false;
    private isInitialized: boolean = false;
    private isReadyResolve: any = null;
    private isReady = new Promise<WebCutHistorySavedState | null>(r => this.isReadyResolve = r);
    /** 最近一次解析出的当前快照（内存缓存），供事务同步取 before */
    private lastState: WebCutProjectHistoryState | null = null;

    constructor(projectId: string) {
        this.projectId = projectId;
    }

    private async updateCurrent(historyId: string | null) {
        this.currentHistoryId = historyId || null;
        const history = await this.getHistoryList();
        this.historyLength = history.length;
        const index = history.findIndex(item => item.id === historyId);
        this.currentIndex = index;
        this.currentHistoryData = index !== -1 ? history[index] : null;
        return this.currentHistoryData;
    }

    private resetCurrent() {
        this.currentHistoryId = null;
        this.currentHistoryData = null;
        this.currentIndex = -1;
        this.historyLength = 0;
    }

    // 为历史行解析出完整快照（快照表优先，兼容旧版内联字段）
    private async resolveState(history: WebCutProjectHistoryData | null): Promise<WebCutProjectHistoryState | null> {
        if (!history) {
            return null;
        }
        // 快照已由上层解析过则直接使用
        if ((history as any).snapshot) {
            this.lastState = (history as any).snapshot;
            return this.lastState;
        }
        const state = await getProjectHistorySnapshot(history.id);
        if (state) {
            this.lastState = state;
        }
        return state;
    }

    /** 同步获取当前指针对应的快照（内存缓存，未解析时为 null） */
    getCurrentStateSync() {
        return this.lastState;
    }

    // 初始化，从数据库加载历史记录，并且在有存储的当前项目状态时，返回该状态
    async init(): Promise<WebCutHistorySavedState | null> {
        if (this.isInitialized || this.isInitializing) {
            return await this.ready();
        }

        this.isInitializing = true;

        let currentHistory: WebCutProjectHistoryData | null = null;
        try {
            const savedState = await getProjectState(this.projectId);
            if (savedState) {
                const { aspectRatio, historyAt } = savedState;
                currentHistory = await this.updateCurrent(historyAt);
                if (currentHistory) {
                    const state = await this.resolveState(currentHistory);
                    if (state) {
                        this.isReadyResolve({
                            aspectRatio,
                            state,
                        });
                    }
                }
            }
        }
        catch (error) {}

        // 即使失败了，也标记为已初始化
        if (!currentHistory) {
            this.resetCurrent();
            this.isReadyResolve(null);
        }

        this.isInitialized = true;
        return await this.ready();
    }

    ready() {
        return this.isReady;
    }

    // 获取历史记录列表
    async getHistoryList(): Promise<WebCutProjectHistoryData[]> {
        return await getProjectHistory(this.projectId);
    }

    // 获取历史记录长度
    async getHistoryLength(): Promise<number> {
        await this.ready();
        return this.historyLength;
    }

    // 获取当前历史记录ID
    async getCurrentHistoryId() {
        return this.currentHistoryId;
    }

    // 获取当前历史记录完整数据
    async getCurrentHistory() {
        return this.currentHistoryData;
    }

    // 获取当前历史记录对应的项目快照（内存缓存优先，避免每次落账多一次 IO）
    async getCurrentState() {
        if (!this.currentHistoryData) {
            return null;
        }
        if (this.lastState) {
            return this.lastState;
        }
        return await this.resolveState(this.currentHistoryData);
    }

    // 当前指针是否在最后一条（手势合并只允许发生在栈顶）
    isAtLast() {
        return this.historyLength > 0 && this.currentIndex === this.historyLength - 1;
    }

    // 保存当前状态到历史记录
    async push(payload: WebCutProjectHistoryPushPayload | WebCutProjectHistoryState): Promise<string> {
        await this.ready();
        const data: WebCutProjectHistoryPushPayload = 'state' in payload && !('patch' in payload)
            ? { state: payload as WebCutProjectHistoryState }
            : payload as WebCutProjectHistoryPushPayload;

        const historyId = await pushProjectHistoryEntry(this.projectId, data);
        await this.updateCurrent(historyId);
        const state = data.snapshot || data.state;
        if (state) {
            this.lastState = state;
        }
        return historyId!;
    }

    /**
     * 原地更新最后一条历史记录（手势合并），返回是否成功
     */
    async updateEntry(historyId: string, payload: Partial<WebCutProjectHistoryPushPayload>) {
        await this.ready();
        if (this.currentHistoryId !== historyId) {
            return false;
        }
        const nextId = await updateProjectHistoryEntry(this.projectId, historyId, payload);
        if (!nextId) {
            return false;
        }
        await this.updateCurrent(nextId);
        const state = payload.snapshot || payload.state;
        if (state) {
            this.lastState = state;
        }
        return true;
    }

    // 撤销操作，返回目标历史记录（已附带解析好的快照）
    async undo(): Promise<WebCutProjectHistoryData | null> {
        await this.ready();

        // 移动历史记录指针
        const historyData = await moveProjectHistoryTo(this.projectId, -1);
        if (!historyData) {
            return null;
        }

        const { id } = historyData;
        await this.updateCurrent(id);
        // 直接解析目标快照，恢复时不再依赖运行态反推
        (historyData as any).snapshot = await this.resolveState(historyData);

        return historyData;
    }

    // 重做操作，返回目标历史记录（已附带解析好的快照）
    async redo(): Promise<WebCutProjectHistoryData | null> {
        await this.ready();

        const historyData = await moveProjectHistoryTo(this.projectId, 1);
        if (!historyData) {
            return null;
        }

        const { id } = historyData;
        await this.updateCurrent(id);
        (historyData as any).snapshot = await this.resolveState(historyData);

        return historyData;
    }

    async moveTo(historyId: string): Promise<WebCutProjectHistoryData | null> {
        await this.ready();
        const historyData = await moveProjectHistoryToId(this.projectId, historyId);
        if (!historyData) {
            return null;
        }
        await this.updateCurrent(historyData.id);
        (historyData as any).snapshot = await this.resolveState(historyData);
        return historyData;
    }

    // 清除历史记录
    async clear(): Promise<void> {
        await clearProjectHistory(this.projectId);
        this.currentHistoryId = null;
        this.currentHistoryData = null;
        this.currentIndex = -1;
        this.historyLength = 0;
        this.lastState = null;
    }

    // 检查是否可以撤销
    canUndo(): boolean {
        if (!this.isInitialized) {
            return false;
        }
        if (this.historyLength <= 1) {
            return false;
        }
        return this.currentIndex > 0;
    }

    // 检查是否可以重做
    canRedo(): boolean {
        if (!this.isInitialized) {
            return false;
        }
        if (this.historyLength <= 1) {
            return false;
        }

        return this.currentIndex < this.historyLength - 1;
    }
}

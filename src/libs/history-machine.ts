import { WebCutHistoryState } from '../types';
import { pushProjectHistory, getProjectHistory, clearProjectHistory, moveProjectHistoryTo, getProjectState } from '../db';

// 历史记录管理器类
export class HistoryMachine {
  history: {
    id: string;
    projectId: string;
    timestamp: number;
    state: WebCutHistoryState
  }[] = [];
  private currentIndex: number = -1;
  private projectId: string;
  private maxHistoryLength: number = 50;
  isInitialized: boolean = false;
  projectState: any = null;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  // 初始化，从数据库加载历史记录
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const savedHistory = await getProjectHistory(this.projectId);
      const savedState = await getProjectState(this.projectId);
      if (savedHistory && savedHistory.length > 0) {
        this.history = savedHistory;
        if (savedState?.historyAt) {
          this.currentIndex = this.history.findIndex((item: any) => item.id === savedState.historyAt) + 1;
        }
        else {
          this.currentIndex = this.history.length;
        }
      }
      this.isInitialized = true;
      this.projectState = savedState;
    } catch (error) {
      console.error('Failed to initialize history:', error);
      this.isInitialized = true;
    }
  }

  // 保存当前状态到历史记录
  async push(state: WebCutHistoryState): Promise<string | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      // 如果当前不是在历史记录的最后，删除后面的历史记录
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }

      // 限制历史记录长度
      if (this.history.length >= this.maxHistoryLength) {
        this.history.shift();
        this.currentIndex--;
      }

      // 保存到数据库
      const historyId = await pushProjectHistory(this.projectId, state);
      if (historyId) {
        this.history.push({
          id: historyId,
          projectId: this.projectId,
          timestamp: Date.now(),
          state,
        });
        this.currentIndex = this.history.length - 1;
        return historyId;
      }
      return null;
    } catch (error) {
      console.error('Failed to save history:', error);
      return null;
    }
  }

  // 撤销操作
  async undo(): Promise<WebCutHistoryState | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.currentIndex <= 0) {
      return null; // 已经是最早的历史记录
    }

    // 移动历史记录指针
    await moveProjectHistoryTo(this.projectId, -1);

    this.currentIndex--;
    return this.history[this.currentIndex]?.state;
  }

  // 重做操作
  async redo(): Promise<WebCutHistoryState | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.currentIndex >= this.history.length) {
      return null; // 已经是最新的历史记录
    }

    // 移动历史记录指针
    await moveProjectHistoryTo(this.projectId, 1);

    const next = this.history[this.currentIndex];
    this.currentIndex++;
    return next?.state;
  }

  // 清除历史记录
  async clear(): Promise<void> {
    try {
      await clearProjectHistory(this.projectId);
      this.history = [];
      this.currentIndex = -1;
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  // 获取当前历史记录状态
  getCurrentState(): WebCutHistoryState | null {
    return this.history[this.currentIndex]?.state;
  }

  // 获取历史记录长度
  getProjectHistoryLength(): number {
    return this.history.length;
  }

  // 获取当前索引
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  // 检查是否可以撤销
  canUndo(): boolean {
    return this.isInitialized && this.currentIndex > 0;
  }

  // 检查是否可以重做
  canRedo(): boolean {
    return this.isInitialized && this.currentIndex < this.history.length;
  }
}
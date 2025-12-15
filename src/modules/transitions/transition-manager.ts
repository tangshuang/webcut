import { WebCutBaseTransition, WebCutTransitionConfig } from './base-transition';

/**
 * 转场管理器类
 */
export class TransitionManager {
  private transitions: Map<string, WebCutBaseTransition> = new Map();

  /**
   * 注册转场效果
   * @param transition 转场实例
   */
  registerTransition(transition: WebCutBaseTransition): void {
    this.transitions.set(transition.name, transition);
  }

  /**
   * 获取转场实例
   * @param name 转场名称
   * @returns 转场实例
   */
  getTransition(name: string): WebCutBaseTransition | undefined {
    return this.transitions.get(name);
  }

  /**
   * 获取所有已注册的转场名称
   * @returns 转场名称列表
   */
  getTransitionNames(): string[] {
    return Array.from(this.transitions.keys());
  }

  /**
   * 获取所有已注册转场的默认配置
   */
  getTransitionDefaults() {
    const names = this.getTransitionNames();
    const defaults: Record<string, {
      name: string;
      title: string;
      defaultDuration: number;
      defaultConfig: WebCutTransitionConfig;
    }> = {};
    names.forEach((name) => {
      const trans = this.getTransition(name);
      defaults[name] = {
        name,
        title: trans?.title || name,
        defaultDuration: trans?.defaultDuration || 0,
        defaultConfig: trans?.defaultConfig || {},
      };
    });
    return defaults;
  }

  /**
   * 应用转场效果
   * @param frame1 起始帧
   * @param frame2 结束帧
   * @param progress 进度值，0-1之间
   * @param transitionName 转场名称
   * @param config 转场配置
   * @returns 处理后的VideoFrame
   */
  async applyTransition(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    transitionName: string,
    config: WebCutTransitionConfig = {}
  ): Promise<VideoFrame> {
    const transition = this.getTransition(transitionName);

    if (!transition) {
      console.warn(`Transition "${transitionName}" not found, using default blend`);
      return this.defaultBlend(frame1, frame2, progress);
    }

    try {
      return await transition.apply(frame1, frame2, progress, config);
    } catch (error) {
      console.error(`Error applying transition "${transitionName}":`, error);
      return this.defaultBlend(frame1, frame2, progress);
    }
  }

  /**
   * 生成转场帧序列
   * @param frame1 起始帧
   * @param frame2 结束帧
   * @param transitionName 转场名称
   * @param frameCount 帧数量
   * @param config 转场配置
   * @returns 转场帧序列
   */
  async generateTransitionFrames(
    frame1: VideoFrame,
    frame2: VideoFrame,
    transitionName: string,
    frameCount: number,
    config: WebCutTransitionConfig = {}
  ): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];

    for (let i = 0; i < frameCount; i++) {
      const progress = frameCount > 1 ? i / (frameCount - 1) : 1;

      const frame = await this.applyTransition(
        frame1,
        frame2,
        progress,
        transitionName,
        config
      );
      frames.push(frame);
    }

    return frames;
  }

  /**
   * 默认混合效果（简单的透明度混合）
   */
  private async defaultBlend(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number
  ): Promise<VideoFrame> {
    const canvas = new OffscreenCanvas(frame1.displayWidth, frame1.displayHeight);
    const ctx = canvas.getContext('2d')!;

    // 绘制起始帧
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(frame1, 0, 0);

    // 绘制结束帧
    ctx.globalAlpha = progress;
    ctx.drawImage(frame2, 0, 0);

    ctx.globalAlpha = 1;

    return new VideoFrame(canvas, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });
  }

  /**
   * 关闭转场管理器，释放所有转场资源
   */
  dispose(): void {
    for (const transition of this.transitions.values()) {
      transition.dispose();
    }
    this.transitions.clear();
  }
}

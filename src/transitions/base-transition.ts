/**
 * 转场配置接口
 */
export interface WebCutTransitionConfig {
  [key: string]: any;
}

/**
 * 转场基类
 * 与滤镜不同，转场需要处理两个帧（from和to），并根据进度生成过渡帧
 */
export abstract class WebCutBaseTransition {
  /**
   * 转场名称
   */
  abstract name: string;
  abstract title: string;
  /**
   * 默认持续时间（微秒）
   */
  abstract defaultDuration: number;
  /**
   * 默认配置
   */
  abstract defaultConfig: WebCutTransitionConfig;

  /**
   * 应用转场效果到两个VideoFrame
   * @param frame1 起始帧
   * @param frame2 结束帧
   * @param progress 进度值，0-1之间
   * @param config 转场配置
   * @returns 处理后的VideoFrame
   */
  abstract apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    config: WebCutTransitionConfig
  ): Promise<VideoFrame>;

  /**
   * 关闭转场资源
   */
  dispose(): void {
    // 默认实现，子类可重写
  }

  /**
   * 创建带有正确时间戳的VideoFrame
   * @param canvas 画布
   * @param timestamp 时间戳（微秒）
   * @param duration 持续时间（微秒）
   */
  protected createVideoFrame(
    canvas: OffscreenCanvas,
    timestamp: number,
    duration?: number
  ): VideoFrame {
    return new VideoFrame(canvas, {
      timestamp,
      duration: duration || undefined,
    });
  }
}

/**
 * 滤镜配置接口
 */
export interface WebCutFilterParams {
  [key: string]: any;
}

/**
 * 滤镜基类
 */
export abstract class WebCutBaseFilter {
  /**
   * 滤镜名称
   */
  abstract name: string;
  abstract title: string;
  abstract defaultParams: WebCutFilterParams;

  /**
   * 应用滤镜到VideoFrame
   * @param frame 原始VideoFrame
   * @param params 滤镜配置
   * @returns 处理后的VideoFrame
   */
  abstract apply(frame: VideoFrame, params: WebCutFilterParams): Promise<VideoFrame>;

  /**
   * 关闭滤镜资源
   */
  dispose(): void {
    // 默认实现，子类可重写
  }
}

// 导出参数类型定义
export interface WebCutExportVideoParams {
  resolution: '1080P' | '720P' | '480P' | '360P';
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  audio: boolean; // 是否包含音频
  codec: string;
  format: string
}

export interface WebCutExportAudioParams {
  bitrate: number;
  format: string;
  sampleRate: number;
}

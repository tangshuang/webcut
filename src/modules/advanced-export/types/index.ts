// 导出参数类型定义
import type { WebCutResolution } from '../../../types';

export interface WebCutExportVideoParams {
  resolution: WebCutResolution;
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

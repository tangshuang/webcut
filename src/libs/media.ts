import { MP4Clip, AudioClip, OffscreenSprite, Combinator } from "@webav/av-cliper";
import { blobToFile } from "./file";

export async function mp4ClipToFile(clip: MP4Clip) {
    await clip.ready;
    const sprite = new OffscreenSprite(clip);

    const { width, height, duration } = clip.meta;
    Object.assign(sprite.rect, { w: width, h: height });
    sprite.time.duration = duration;

    const combiner = new Combinator({ width, height });
    await combiner.addSprite(sprite, { main: true });

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    const readableStream = combiner.output();
    const response = new Response(readableStream, { headers });

    const blob = await response.clone().blob();
    const file = blobToFile(blob, 'video.mp4');

    combiner.destroy();
    sprite.destroy();
    clip.destroy();

    return file;
}

export async function audioClipToFile(clip: AudioClip) {
    await clip.ready;
    const pcm = clip.getPCMData();
    const sampleRate = clip.meta.sampleRate;
    const wavBlob = pcmToWav(pcm, sampleRate);
    const file = blobToFile(wavBlob, 'audio-clip-to-file.wav');
    return file;
}

export function pcmToWav(pcmData: Float32Array[], sampleRate = 44100) {
  // pcmData 预期格式为：[channel1Data, channel2Data, ...]
  // 其中 channel1Data, channel2Data 是 Float32Array 或普通数字数组，包含该声道的样本数据

  if (!pcmData || pcmData.length === 0 || !pcmData[0] || pcmData[0].length === 0) {
    throw new Error("PCM 数据必须是一个包含声道数据的数组，且至少包含一个声道和一个样本。");
  }

  const numChannels = pcmData.length;
  const numSamplesPerChannel = pcmData[0].length; // 假设所有声道长度相同

  // （可选）验证所有声道是否具有相同数量的样本
  for (let i = 1; i < numChannels; i++) {
    if (!pcmData[i] || pcmData[i].length !== numSamplesPerChannel) {
      throw new Error("所有声道必须包含相同数量的样本，并且是有效的数组。");
    }
  }

  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8; // 对于16位PCM，每个样本2字节
  const headerSize = 44; // WAV文件头的大小

  // 音频数据的总字节数
  const audioDataSize = numSamplesPerChannel * numChannels * bytesPerSample;
  // 文件总大小 = 文件头大小 + 音频数据大小
  const fileSize = headerSize + audioDataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // --- WAV 文件头 ---
  // 块ID "RIFF" (偏移量 0, 4字节)
  view.setUint32(0, 0x52494646, false); // "RIFF" (大端序)
  // 块大小 (偏移量 4, 4字节) = 文件总大小 - 8 (RIFF标识符和此字段本身的大小)
  view.setUint32(4, fileSize - 8, true); // 小端序
  // 格式 "WAVE" (偏移量 8, 4字节)
  view.setUint32(8, 0x57415645, false); // "WAVE" (大端序)

  // 子块1 ID "fmt " (偏移量 12, 4字节)
  view.setUint32(12, 0x666d7420, false); // "fmt " (大端序)
  // 子块1 大小 (偏移量 16, 4字节) - 对于PCM，通常为16
  view.setUint32(16, 16, true); // 小端序
  // 音频格式 (偏移量 20, 2字节) - 1 表示 PCM
  view.setUint16(20, 1, true); // 小端序
  // 声道数 (偏移量 22, 2字节)
  view.setUint16(22, numChannels, true); // 小端序
  // 采样率 (偏移量 24, 4字节)
  view.setUint32(24, sampleRate, true); // 小端序
  // 字节率 (偏移量 28, 4字节) = SampleRate * NumChannels * BitsPerSample/8
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // 小端序
  // 块对齐 (偏移量 32, 2字节) = NumChannels * BitsPerSample/8
  view.setUint16(32, numChannels * bytesPerSample, true); // 小端序
  // 每个样本的位数 (偏移量 34, 2字节)
  view.setUint16(34, bitsPerSample, true); // 小端序

  // 子块2 ID "data" (偏移量 36, 4字节)
  view.setUint32(36, 0x64617461, false); // "data" (大端序)
  // 子块2 大小 (偏移量 40, 4字节) = 音频数据的总字节数
  view.setUint32(40, audioDataSize, true); // 小端序

  // --- PCM 数据 ---
  // 从文件头的末尾 (44字节处) 开始写入数据
  let dataIndex = headerSize;
  for (let i = 0; i < numSamplesPerChannel; i++) { // 遍历每个采样帧
    for (let ch = 0; ch < numChannels; ch++) {    // 遍历当前采样帧的每个声道
      // 获取浮点数样本值，并将其限制在 [-1.0, 1.0] 范围内
      const sampleFloat = Math.max(-1, Math.min(1, pcmData[ch][i]));

      // 将浮点数样本转换为16位有符号整数PCM值
      let sampleInt;
      if (sampleFloat < 0) {
        sampleInt = sampleFloat * 0x8000; // 对于负数，乘以32768
      } else {
        sampleInt = sampleFloat * 0x7FFF; // 对于正数，乘以32767
      }
      // 确保转换后的值在16位有符号整数范围内 (尽管setInt16会自动处理溢出，但显式处理更佳)
      // sampleInt = Math.max(-32768, Math.min(32767, Math.round(sampleInt))); // 可选：四舍五入

      view.setInt16(dataIndex, sampleInt, true); // 以小端序写入16位有符号整数
      dataIndex += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
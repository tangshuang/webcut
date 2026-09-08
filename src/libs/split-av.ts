/**
 * 音画分离音轨提取（纯前端 mediabunny）。
 *
 * 与 ffmpeg.wasm 相比的优势：流式处理（无需把整个文件写入 wasm 内存文件系统再读出，
 * 内存占用小、无 MEMFS 双倍拷贝），纯 JS demux/mux，速度≈IO。
 *
 * 音轨直接逐包 copy（不重编码）到 m4a 容器（mp4 容器纯音频），经 copyAudioTrackNormalized
 * 做负时间戳归一（AAC priming / edit list 源）与单调化（mkv 毫秒取整抖动源）。
 * AudioClip（WebCodecs 解码）与 <audio> 均原生支持 m4a。
 *
 * 错误以 message code 抛出，调用方回退 ffmpeg 路径：
 * - NO_AUDIO_TRACK：源无音轨
 * - AUDIO_TIMESTAMPS_CORRUPT：时间戳累计修正超限（异常损坏源）
 * - AUDIO_REMUX_FAILED：remux 产出为空
 */
import { copyAudioTrackNormalized } from './remux';

export async function extractAudioByRemux(blob: Blob): Promise<Blob> {
    // @ts-ignore 运行时动态 import（保持按需加载）
    const mb: any = await import('mediabunny');
    const { Input, BlobSource, Output, Mp4OutputFormat, BufferTarget, EncodedAudioPacketSource, ALL_FORMATS } = mb;

    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        const audioTrack = await input.getPrimaryAudioTrack();
        if (!audioTrack) throw new Error('NO_AUDIO_TRACK');

        const target = new BufferTarget();
        const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
        const audioSource = new EncodedAudioPacketSource(audioTrack.codec);
        out.addAudioTrack(audioSource, {
            decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined,
        });
        await out.start();

        await copyAudioTrackNormalized({ mb, audioTrack, audioSource });

        await out.finalize();

        const buffer = target.buffer;
        if (!buffer) throw new Error('AUDIO_REMUX_FAILED');
        return new Blob([buffer], { type: 'audio/mp4' });
    }
    finally {
        try { input.dispose?.(); } catch { /* noop */ }
    }
}

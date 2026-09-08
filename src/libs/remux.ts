/**
 * 容器级无损 remux（纯前端 mediabunny）：任意支持的输入格式（mp4/mov/mkv/webm/ts…）
 * → MP4，不重编码、流式处理（无 ffmpeg.wasm MEMFS 双倍内存拷贝），速度≈IO。
 *
 * 移植自 aigc split-av.ts 的轨道级 copy 范式：EncodedPacketSink 逐包 copy 到
 * EncodedVideoPacketSource / EncodedAudioPacketSource（保留 rotation 与 decoderConfig），
 * fastStart 'in-memory' 对齐 ffmpeg `-movflags faststart` 的 moov 前置行为。
 *
 * 负时间戳归一：部分源的包带负 timestamp（AAC priming / edit list，常见于 mov），
 * IsobmffMuxer 校验拒绝；先以 metadataOnly 轻量扫描各轨最小时间戳，copy 时构造
 * 整体偏移后的新包（等价 ffmpeg copy 内部的 elst 处理语义，各轨独立归一，
 * A/V 相对呈现关系不受影响）。
 *
 * 错误以 message code 抛出，调用方回退 ffmpeg：
 * - NO_VIDEO_TRACK：无视频轨
 * - REMUX_FAILED：产出为空（编解码与 mp4 容器不兼容等）
 */

export interface RemuxToMp4Options {
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
}

/** metadataOnly 轻量扫描轨道最小 timestamp（≤0；不读取包数据） */
async function scanMinTimestamp(sink: any): Promise<number> {
    let min = 0;
    let packet = await sink.getFirstPacket({ metadataOnly: true });
    while (packet) {
        if (packet.timestamp < min) min = packet.timestamp;
        packet = await sink.getNextPacket(packet, { metadataOnly: true });
    }
    return min;
}

/** 批量让出主线程工厂：逐包让出（setTimeout 最小间隔 1~4ms）会让数千包的 remux 凭空多出秒级开销，每 30 包让一次 */
function createUIYielder(): () => Promise<void> {
    let counter = 0;
    return async () => {
        counter += 1;
        if (counter % 30 === 0) {
            await new Promise<void>((r) => setTimeout(r, 0));
        }
    };
}

/** 按偏移构造新包（timestamp 非负化）；offset 为 0 时原样返回 */
function shiftPacket(EncodedPacketCtor: any, packet: any, offset: number): any {
    if (offset <= 0 || packet.timestamp >= 0) return packet;
    return new EncodedPacketCtor(
        packet.data,
        packet.type,
        packet.timestamp + offset,
        packet.duration,
        packet.sequenceNumber,
        packet.byteLength,
        packet.sideData,
    );
}

export async function remuxToMp4(blob: Blob, opts: RemuxToMp4Options = {}): Promise<Blob> {
    const { onProgress, isCancelled } = opts;

    // @ts-ignore 运行时动态 import（保持按需加载）
    const mb: any = await import('mediabunny');
    const {
        Input, BlobSource, Output, Mp4OutputFormat, BufferTarget, EncodedPacket,
        EncodedPacketSink, EncodedVideoPacketSource, EncodedAudioPacketSource, ALL_FORMATS,
    } = mb;

    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const yieldToUIThrottled = createUIYielder();
    try {
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('NO_VIDEO_TRACK');
        const audioTrack = await input.getPrimaryAudioTrack();

        // 预扫描各轨最小 timestamp（负 ts 场景的归一偏移量）
        let videoOffset = 0;
        let audioOffset = 0;
        {
            const videoSink = new EncodedPacketSink(videoTrack);
            videoOffset = -await scanMinTimestamp(videoSink);
            if (audioTrack) {
                const audioSink = new EncodedPacketSink(audioTrack);
                audioOffset = -await scanMinTimestamp(audioSink);
            }
        }

        const target = new BufferTarget();
        const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
        const videoCodec = videoTrack.codec as string || 'avc';
        const videoSource = new EncodedVideoPacketSource(videoCodec);
        out.addVideoTrack(videoSource, {
            rotation: videoTrack.rotation ?? undefined,
            decoderConfig: (await videoTrack.getDecoderConfig()) ?? undefined,
        });
        let audioSource: any = null;
        if (audioTrack) {
            audioSource = new EncodedAudioPacketSource(audioTrack.codec);
            out.addAudioTrack(audioSource, {
                decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined,
            });
        }
        await out.start();

        // 估算总时长用于进度（帧率未知按 30 兜底，仅进度显示用）
        const durationGuess = (await input.getDurationFromMetadata()) || 0;

        // 视频轨逐包 copy（decode order；首包 meta 带 decoderConfig）
        const videoSink = new EncodedPacketSink(videoTrack);
        let packet = await videoSink.getFirstPacket();
        let first = true;
        while (packet) {
            if (isCancelled?.()) {
                try { await out.cancel(); } catch { /* noop */ }
                throw new Error('CANCELLED');
            }
            const shifted = shiftPacket(EncodedPacket, packet, videoOffset);
            await videoSource.add(shifted, first ? { decoderConfig: (await videoTrack.getDecoderConfig()) ?? undefined } : undefined);
            first = false;
            if (durationGuess > 0 && packet.timestamp >= 0) onProgress?.(Math.min(1, packet.timestamp / durationGuess));
            packet = await videoSink.getNextPacket(packet);
            // 批量让出主线程，避免长视频阻塞 UI
            await yieldToUIThrottled();
        }
        try { videoSource.close?.(); } catch { /* noop */ }

        // 音轨逐包 copy（decode order；首包 meta 带 decoderConfig）
        // 时间戳单调化：部分源（mkv 毫秒取整抖动 / 封装瑕疵）音轨 ts 非严格递增，
        // IsobmffMuxer 要求全序单调；回退包按「前包 ts + 0.1ms」修正（毫秒级，不可感知）
        if (audioSource) {
            const audioSink = new EncodedPacketSink(audioTrack);
            let audioPacket = await audioSink.getFirstPacket();
            let audioFirst = true;
            let prevAudioTs = -Infinity;
            while (audioPacket) {
                if (isCancelled?.()) {
                    try { await out.cancel(); } catch { /* noop */ }
                    throw new Error('CANCELLED');
                }
                let ts = audioPacket.timestamp + audioOffset;
                if (ts < prevAudioTs) ts = prevAudioTs + 1e-4;
                prevAudioTs = ts;
                const shifted = new EncodedPacket(
                    audioPacket.data,
                    audioPacket.type,
                    ts,
                    audioPacket.duration,
                    audioPacket.sequenceNumber,
                    audioPacket.byteLength,
                    audioPacket.sideData,
                );
                await audioSource.add(shifted, audioFirst ? { decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined } : undefined);
                audioFirst = false;
                audioPacket = await audioSink.getNextPacket(audioPacket);
                await yieldToUIThrottled();
            }
            try { audioSource.close?.(); } catch { /* noop */ }
        }
        await out.finalize();

        const buffer = target.buffer;
        if (!buffer) throw new Error('REMUX_FAILED');
        return new Blob([buffer], { type: 'video/mp4' });
    }
    finally {
        try { input.dispose?.(); } catch { /* noop */ }
    }
}

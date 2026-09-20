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

/**
 * 音轨归一化 copy（供 remuxToMp4 与声音分离的音轨提取共用）：
 * - 负 timestamp 归一：metadataOnly 预扫描最小 ts，copy 时整体偏移（等价 elst 语义）
 * - 单调化：非严格递增的源（mkv 毫秒取整抖动等）按「前包 ts + 0.1ms」修正；
 *   累计修正超过 0.5s 视为异常损坏源，抛 AUDIO_TIMESTAMPS_CORRUPT 由调用方回退 ffmpeg
 * - 批量让出主线程
 */
export async function copyAudioTrackNormalized(args: {
    mb: any;
    audioTrack: any;
    audioSource: any;
    isCancelled?: () => boolean;
}): Promise<void> {
    const { mb, audioTrack, audioSource, isCancelled } = args;
    const { EncodedPacket, EncodedPacketSink } = mb;

    const audioSink = new EncodedPacketSink(audioTrack);
    const offset = -await scanMinTimestamp(audioSink);
    const decoderConfig = (await audioTrack.getDecoderConfig()) ?? undefined;

    let packet = await audioSink.getFirstPacket();
    let first = true;
    let prevTs = -Infinity;
    let totalDrift = 0;
    let counter = 0;
    while (packet) {
        if (isCancelled?.()) throw new Error('CANCELLED');
        let ts = packet.timestamp + offset;
        if (ts < prevTs) {
            totalDrift += prevTs + 1e-4 - ts;
            if (totalDrift > 0.5) throw new Error('AUDIO_TIMESTAMPS_CORRUPT');
            ts = prevTs + 1e-4;
        }
        prevTs = ts;
        const shifted = offset > 0 || ts !== packet.timestamp
            ? new EncodedPacket(packet.data, packet.type, ts, packet.duration, packet.sequenceNumber, packet.byteLength, packet.sideData)
            : packet;
        await audioSource.add(shifted, first ? { decoderConfig } : undefined);
        first = false;
        packet = await audioSink.getNextPacket(packet);
        counter += 1;
        if (counter % 30 === 0) {
            await new Promise<void>((r) => setTimeout(r, 0));
        }
    }
    try { audioSource.close?.(); } catch { /* noop */ }
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

/**
 * 画面变速合成（纯前端 mediabunny，零重编码）：源视频画面轨时间戳按 rate 压缩
 * （ts/rate，>1 加速 <1 减速，等价 ffmpeg setpts=PTS/rate 但无滤镜重编码），
 * 与「变速不变调」音轨（调用方 atempo 产物，时间轴已=源/rate）合成单一 mp4。
 * 产物以 1x 播放即为变速不变调效果，可直接替换原素材。
 *
 * 错误以 message code 抛出：NO_VIDEO_TRACK / NO_AUDIO_TRACK / COMPOSE_FAILED。
 */
export async function composeSpeedChangedVideo(opts: {
    /** 原视频（画面轨原速） */
    sourceBlob: Blob;
    /** 变速不变调音轨（m4a，内容时长=源/rate） */
    audioBlob: Blob;
    /** 目标播放速率（>1 加速，<1 减速） */
    rate: number;
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
}): Promise<Blob> {
    const { sourceBlob, audioBlob, rate, onProgress, isCancelled } = opts;
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('INVALID_RATE');

    // @ts-ignore 运行时动态 import（保持按需加载）
    const mb: any = await import('mediabunny');
    const {
        Input, BlobSource, Output, Mp4OutputFormat, BufferTarget, EncodedPacket,
        EncodedPacketSink, EncodedVideoPacketSource, EncodedAudioPacketSource, ALL_FORMATS,
    } = mb;

    const videoInput = new Input({ source: new BlobSource(sourceBlob), formats: ALL_FORMATS });
    const audioInput = new Input({ source: new BlobSource(audioBlob), formats: ALL_FORMATS });
    const yieldToUIThrottled = createUIYielder();
    try {
        const videoTrack = await videoInput.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('NO_VIDEO_TRACK');
        const audioTrack = await audioInput.getPrimaryAudioTrack();
        if (!audioTrack) throw new Error('NO_AUDIO_TRACK');

        // 画面轨 ts 归一偏移（负 ts 源；除以 rate 后仍保序保非负）
        const videoSink = new EncodedPacketSink(videoTrack);
        const offset = -await scanMinTimestamp(videoSink);

        const target = new BufferTarget();
        const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
        const videoSource = new EncodedVideoPacketSource(videoTrack.codec as string || 'avc');
        out.addVideoTrack(videoSource, {
            rotation: videoTrack.rotation ?? undefined,
            decoderConfig: (await videoTrack.getDecoderConfig()) ?? undefined,
        });
        const audioSource = new EncodedAudioPacketSource(audioTrack.codec);
        out.addAudioTrack(audioSource, {
            decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined,
        });
        await out.start();

        const durationGuess = (await videoInput.getDurationFromMetadata()) || 0;
        const decoderConfig = (await videoTrack.getDecoderConfig()) ?? undefined;

        // 画面轨：逐包 copy，时间戳压缩（归一后 / rate）
        let packet = await videoSink.getFirstPacket();
        let first = true;
        while (packet) {
            if (isCancelled?.()) {
                try { await out.cancel(); } catch { /* noop */ }
                throw new Error('CANCELLED');
            }
            const ts = (packet.timestamp + offset) / rate;
            const shifted = new EncodedPacket(
                packet.data,
                packet.type,
                ts,
                packet.duration,
                packet.sequenceNumber,
                packet.byteLength,
                packet.sideData,
            );
            await videoSource.add(shifted, first ? { decoderConfig } : undefined);
            first = false;
            if (durationGuess > 0 && packet.timestamp >= 0) onProgress?.(Math.min(1, packet.timestamp / durationGuess));
            packet = await videoSink.getNextPacket(packet);
            await yieldToUIThrottled();
        }
        try { videoSource.close?.(); } catch { /* noop */ }

        // 音轨：归一化 copy（atempo 产物时间轴已与压缩后画面对齐）
        try {
            await copyAudioTrackNormalized({ mb, audioTrack, audioSource, isCancelled });
        }
        catch (err) {
            if (String((err as Error)?.message || err) === 'CANCELLED') {
                try { await out.cancel(); } catch { /* noop */ }
            }
            throw err;
        }

        await out.finalize();
        const buffer = target.buffer;
        if (!buffer) throw new Error('COMPOSE_FAILED');
        return new Blob([buffer], { type: 'video/mp4' });
    }
    finally {
        try { videoInput.dispose?.(); } catch { /* noop */ }
        try { audioInput.dispose?.(); } catch { /* noop */ }
    }
}

/**
 * 音视频截段（纯前端 mediabunny，零重编码）：保留 [startSec, startSec+durationSec) 内容
 * remux 为单一 mp4（画面+主音轨），时间轴平移到 0。sliceByFFmpeg（-ss -t -c copy）的
 * mediabunny 对应版：画面从 start 前最近关键帧开始（copy 切片的关键帧对齐语义一致），
 * 音轨按包时间戳过滤；容器/编码与 mp4 不兼容时抛错，调用方回退 sliceByFFmpeg。
 *
 * 错误以 message code 抛出：NO_VIDEO_TRACK / SLICE_FAILED。
 */
export async function sliceMediaByRemux(opts: {
    blob: Blob;
    startSec: number;
    durationSec: number;
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
}): Promise<Blob> {
    const { blob, startSec, durationSec, onProgress, isCancelled } = opts;
    if (!Number.isFinite(startSec) || startSec < 0) throw new Error('INVALID_START');
    if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('INVALID_DURATION');

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
        const endSec = startSec + durationSec;

        const target = new BufferTarget();
        const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
        const videoSource = new EncodedVideoPacketSource(videoTrack.codec as string || 'avc');
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

        const decoderConfig = (await videoTrack.getDecoderConfig()) ?? undefined;

        // 画面轨：从 start 前最近关键帧开始（关键帧对齐，语义同 -ss -c copy），到 endSec 为止
        const videoSink = new EncodedPacketSink(videoTrack);
        let packet = await videoSink.getKeyPacket(Math.max(0, startSec));
        let first = true;
        let baseTs = Infinity;
        while (packet) {
            if (isCancelled?.()) {
                try { await out.cancel(); } catch { /* noop */ }
                throw new Error('CANCELLED');
            }
            if (packet.timestamp > endSec) break;
            if (first) baseTs = Math.min(baseTs, packet.timestamp);
            const ts = packet.timestamp - baseTs;
            const shifted = ts === packet.timestamp
                ? packet
                : new EncodedPacket(packet.data, packet.type, ts, packet.duration, packet.sequenceNumber, packet.byteLength, packet.sideData);
            await videoSource.add(shifted, first ? { decoderConfig } : undefined);
            first = false;
            onProgress?.(Math.min(1, Math.max(0, (packet.timestamp - startSec) / durationSec)));
            packet = await videoSink.getNextPacket(packet);
            await yieldToUIThrottled();
        }
        try { videoSource.close?.(); } catch { /* noop */ }

        // 音轨：按包时间戳过滤 [start, end)，平移到 0（近似对齐画面关键帧起点，误差为 GOP 内偏移）
        if (audioSource && Number.isFinite(baseTs)) {
            const audioSink = new EncodedPacketSink(audioTrack);
            const audioDecoderConfig = (await audioTrack.getDecoderConfig()) ?? undefined;
            let audioPacket = await audioSink.getFirstPacket();
            let audioFirst = true;
            while (audioPacket) {
                if (isCancelled?.()) {
                    try { await out.cancel(); } catch { /* noop */ }
                    throw new Error('CANCELLED');
                }
                const ts = audioPacket.timestamp;
                if (ts >= baseTs && ts < endSec) {
                    const shiftedTs = ts - baseTs;
                    const shifted = shiftedTs === audioPacket.timestamp
                        ? audioPacket
                        : new EncodedPacket(audioPacket.data, audioPacket.type, shiftedTs, audioPacket.duration, audioPacket.sequenceNumber, audioPacket.byteLength, audioPacket.sideData);
                    await audioSource.add(shifted, audioFirst ? { decoderConfig: audioDecoderConfig } : undefined);
                    audioFirst = false;
                }
                if (ts >= endSec) break;
                audioPacket = await audioSink.getNextPacket(audioPacket);
                await yieldToUIThrottled();
            }
            try { audioSource.close?.(); } catch { /* noop */ }
        }
        else if (audioSource) {
            // 画面轨为空（起点异常）时兜底关闭音轨源
            try { audioSource.close?.(); } catch { /* noop */ }
        }

        await out.finalize();
        const buffer = target.buffer;
        if (!buffer) throw new Error('SLICE_FAILED');
        return new Blob([buffer], { type: 'video/mp4' });
    }
    finally {
        try { input.dispose?.(); } catch { /* noop */ }
    }
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

        // 预扫描视频轨最小 timestamp（负 ts 场景的归一偏移量；音轨在 copyAudioTrackNormalized 内自行扫描）
        let videoOffset = 0;
        {
            const videoSink = new EncodedPacketSink(videoTrack);
            videoOffset = -await scanMinTimestamp(videoSink);
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

        // 音轨归一化 copy（负 ts 归一 + 单调化 + 累计漂移上限，见 copyAudioTrackNormalized）
        if (audioSource) {
            try {
                await copyAudioTrackNormalized({ mb, audioTrack, audioSource, isCancelled });
            }
            catch (err) {
                if (String((err as Error)?.message || err) === 'CANCELLED') {
                    try { await out.cancel(); } catch { /* noop */ }
                }
                throw err;
            }
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

/**
 * 音画分离音轨提取（纯前端 mediabunny，移植自 aigc split-av.ts 的轨道级 remux 范式）。
 *
 * 与 ffmpeg.wasm 相比的优势：流式处理（无需把整个文件写入 wasm 内存文件系统再读出，
 * 内存占用小、无 MEMFS 双倍拷贝），纯 JS demux/mux，速度≈IO。
 *
 * 音轨直接逐包 copy（EncodedPacketSink → EncodedAudioPacketSource，不重编码）到
 * m4a 容器（mp4 容器纯音频）。AudioClip（WebCodecs AAC 解码）与 <audio> 均原生支持。
 *
 * 错误以 message code 抛出，调用方回退 ffmpeg 路径：
 * - NO_AUDIO_TRACK：源无音轨
 * - AUDIO_REMUX_FAILED：remux 产出为空
 */

export async function extractAudioByRemux(blob: Blob): Promise<Blob> {
    // @ts-ignore 运行时动态 import（保持按需加载）
    const mb: any = await import('mediabunny');
    const { Input, BlobSource, Output, Mp4OutputFormat, BufferTarget, EncodedPacketSink, EncodedAudioPacketSource, ALL_FORMATS } = mb;

    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        const audioTrack = await input.getPrimaryAudioTrack();
        if (!audioTrack) throw new Error('NO_AUDIO_TRACK');

        // 音轨逐包 copy（decode order；首包 meta 带 decoderConfig）
        const sink = new EncodedPacketSink(audioTrack);
        const target = new BufferTarget();
        const out = new Output({ format: new Mp4OutputFormat(), target });
        const codec = audioTrack.codec as string;
        const packetSource = new EncodedAudioPacketSource(codec);
        out.addAudioTrack(packetSource, {
            decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined,
        });
        await out.start();

        let packet = await sink.getFirstPacket();
        let first = true;
        let yieldCounter = 0;
        while (packet) {
            await packetSource.add(packet, first ? { decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined } : undefined);
            first = false;
            packet = await sink.getNextPacket(packet);
            // 批量让出主线程（逐包让出的 setTimeout 最小间隔会让长音轨凭空多出秒级开销）
            yieldCounter += 1;
            if (yieldCounter % 30 === 0) {
                await new Promise<void>((r) => setTimeout(r, 0));
            }
        }
        try { packetSource.close?.(); } catch { /* noop */ }
        await out.finalize();

        const buffer = target.buffer;
        if (!buffer) throw new Error('AUDIO_REMUX_FAILED');
        return new Blob([buffer], { type: 'audio/mp4' });
    }
    finally {
        try { input.dispose?.(); } catch { /* noop */ }
    }
}

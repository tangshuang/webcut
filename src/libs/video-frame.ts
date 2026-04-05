type FrameLike = VideoFrame | ImageBitmap | null | undefined;

type VideoFrameStats = {
    created: number;
    closed: number;
    active: number;
    peak: number;
};

const createdFrames = new WeakSet<VideoFrame>();
const closedFrames = new WeakSet<VideoFrame>();

function isDev() {
    return typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
}

function getStatsStore() {
    if (!isDev() || typeof window === 'undefined') {
        return null;
    }
    const key = '__WEBCUT_VIDEO_FRAME_STATS__';
    const obj = window as unknown as Record<string, VideoFrameStats | undefined>;
    if (!obj[key]) {
        obj[key] = {
            created: 0,
            closed: 0,
            active: 0,
            peak: 0,
        };
    }
    return obj[key]!;
}

export function trackVideoFrameCreated(frame: VideoFrame) {
    if (!isDev()) {
        return;
    }
    if (createdFrames.has(frame)) {
        return;
    }
    createdFrames.add(frame);
    const stats = getStatsStore();
    if (!stats) {
        return;
    }
    stats.created += 1;
    stats.active += 1;
    if (stats.active > stats.peak) {
        stats.peak = stats.active;
    }
}

export function trackVideoFrameClosed(frame: VideoFrame) {
    if (!isDev()) {
        return;
    }
    if (!createdFrames.has(frame) || closedFrames.has(frame)) {
        return;
    }
    closedFrames.add(frame);
    const stats = getStatsStore();
    if (!stats) {
        return;
    }
    stats.closed += 1;
    stats.active = Math.max(0, stats.active - 1);
}

export function createTrackedVideoFrame(image: CanvasImageSource, init?: VideoFrameInit): VideoFrame {
    const frame = new VideoFrame(image, init);
    trackVideoFrameCreated(frame);
    return frame;
}

export function closeTrackedVideoFrame(frame: VideoFrame | null | undefined) {
    if (!frame) {
        return;
    }
    frame.close();
    trackVideoFrameClosed(frame);
}

export function safeCloseFrame(frame: FrameLike) {
    if (!frame) {
        return;
    }
    frame.close?.();
    if (frame instanceof VideoFrame) {
        trackVideoFrameClosed(frame);
    }
}

export async function withVideoFrame<T>(
    image: CanvasImageSource,
    init: VideoFrameInit | undefined,
    fn: (frame: VideoFrame) => Promise<T> | T,
): Promise<T> {
    const frame = createTrackedVideoFrame(image, init);
    try {
        return await fn(frame);
    } finally {
        closeTrackedVideoFrame(frame);
    }
}

export function getVideoFrameStats(): VideoFrameStats | null {
    const stats = getStatsStore();
    if (!stats) {
        return null;
    }
    return { ...stats };
}


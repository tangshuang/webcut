import { computed, watchEffect, watch } from 'vue';
import { useWebCutContext, useWebCutPlayer } from './index';
import { getGridFrame, getGridPixel } from '../libs/timeline';
import { WebCutSegment, WebCutRail } from '../types';
import { clone } from 'ts-fns';

export function useWebCutManager() {
    const {
        cursorTime,
        fps,
        scale,
        canvas,
        duration,
        scroll1,
        scroll2,
        status,
        ruler,
        manager,
        sources,
        updateDuration,
        unselectSegment,
        loading,
        rails,
        enableMainVideoMagnet: contextEnableMainVideoMagnet,
    } = useWebCutContext();
    const { pause, push, syncSourceTickInterceptor } = useWebCutPlayer();
    const enableMainVideoMagnet = contextEnableMainVideoMagnet;

    // 同步两边scroll的滚动情况
    watchEffect(() => {
        if (!scroll1.value || !scroll2.value) {
            return;
        }

        scroll1.value.onScroll((offset: { top: number; left: number }) => {
            const offset2 = scroll2.value.getScrollOffset();
            if (offset2.top !== offset.top) {
                scroll2.value.scrollTo({ top: offset.top }, false, true);
            }
        });

        scroll2.value.onScroll((offset: { top: number; left: number }) => {
            const offset1 = scroll1.value.getScrollOffset();
            if (offset1.top !== offset.top) {
                scroll1.value.scrollTo({ top: offset.top }, false, true);
            }
        });
    });

    // 总帧数
    const totalFrameCount = computed(() => {
        const allFrames = duration.value / 1e6 * fps.value;
        return Math.ceil(allFrames);
    });

    // 总长度，像素
    const totalPx = computed(() => {
        const px = getGridPixel(scale.value, totalFrameCount.value);
        return px;
    });

    // 当前游标所在的帧坐标
    const cursorFrame = computed(() => {
        return Math.ceil(cursorTime.value / 1e6 * fps.value);
    });

    // 游标所处的位置
    const cursorPx = computed(() => {
        return getGridPixel(scale.value, cursorFrame.value);
    });

    watch([status, cursorTime], () => {
        // 从播放状态切换到其他状态
        if (status.value !== 1 && scroll2.value) {
            setTimeout(() => {
                const target = cursorPx.value;
                const outerWidth = scroll2.value.getScrollContainerSize().width;
                const to = target - outerWidth / 2;
                scroll2.value.scrollTo({ left: to }, true, true);
            }, 200);
        }
    });

    // 移动光标到时间(纳秒)
    const moveCursorToTime = (ns: number) => {
        cursorTime.value = ns;
        pause();
        canvas.value?.previewFrame(cursorTime.value);
    };

    // 移动光标到帧坐标
    const moveCursorToFrame = (frame: number) => {
        cursorTime.value = frame / fps.value * 1e6;
        pause();
        canvas.value?.previewFrame(cursorTime.value);
    };

    // 移动光标到像素坐标
    const moveCursorToPx = (offsetLeft: number) => {
        cursorTime.value = getGridFrame(offsetLeft, scale.value, fps.value) * 1e6 / fps.value;
        pause();
        canvas.value?.previewFrame(cursorTime.value);
    };

    // 时间(纳秒)转像素坐标
    const timeToPx = (ns: number) => {
        return getGridPixel(scale.value, Math.round(ns / 1e6 * fps.value));
    };

    // 像素坐标转时间(纳秒)
    const pxToTime = (px: number) => {
        return getGridFrame(px, scale.value, fps.value) / fps.value * 1e6;
    };

    // 一帧的像素长度
    const pxOf1Frame = computed(() => {
        return getGridPixel(scale.value, 1);
    });

    // 一帧的时间长度(纳秒)
    const timeOf1Frame = computed(() => {
        return 1 / fps.value * 1e6;
    });

    // 当改变sgement时间，如通过拖拽改变其大小时，要调用该函数更新
    function resetSegmentTime(segment: WebCutSegment) {
        const { sourceKey, start, end } = segment;
        const source = sources.value.get(sourceKey);
        if (!source) {
            return;
        }
        source.sprite.time.offset = start;
        source.sprite.time.duration = end - start;
        updateDuration();
    }

    function applyMainVideoMagnet(targetRail?: WebCutRail) {
        if (!enableMainVideoMagnet.value) {
            return;
        }

        const mainRail = targetRail || rails.value.find(rail => rail.main && rail.type === 'video');
        if (!mainRail || !mainRail.main || mainRail.type !== 'video' || !mainRail.segments.length) {
            return;
        }

        const sortedSegments = [...mainRail.segments].sort((a, b) => a.start - b.start);
        let cursor = 0;
        for (const segment of sortedSegments) {
            const duration = Math.max(0, segment.end - segment.start);
            segment.start = cursor;
            segment.end = cursor + duration;
            cursor = segment.end;
            resetSegmentTime(segment);
        }
    }

    function resizeManagerMaxHeight(h: number) {
        manager.value?.resizeManagerMaxHeight(h);
    }

    function toggleRailHidden(rail: WebCutRail) {
        const hidden = rail.hidden = !rail.hidden;
        const segments = rail.segments;
        for (let segment of segments) {
            const { sourceKey } = segment;
            const source = sources.value.get(sourceKey);
            if (!source) {
                continue;
            }
            source.sprite.visible = !hidden;
        }
    }

    function toggleRailMute(rail: WebCutRail, mute?: boolean) {
        rail.mute = mute !== undefined ? mute : !rail.mute;
        const segments = rail.segments;
        for (let segment of segments) {
            const { sourceKey } = segment;
            const source = sources.value.get(sourceKey);
            if (!source) {
                continue;
            }
            // 使用复用的syncTickInterceptor函数
            syncSourceTickInterceptor(sourceKey);

            // 调用previewFrame立即显示效果
            canvas.value?.previewFrame(cursorTime.value);
        }
    }

    function deleteSegment({ segment, rail, skipMagnet, keepRailWhenEmpty }: { segment: WebCutSegment; rail: WebCutRail; skipMagnet?: boolean; keepRailWhenEmpty?: boolean }) {
        const { sourceKey } = segment;
        const source = sources.value.get(sourceKey);
        if (source) {
            const { clip, sprite } = source!;
            canvas.value?.removeSprite(sprite);
            sprite.destroy();
            clip.destroy();
            sources.value.delete(sourceKey);
        }

        const segmentIndex = rail.segments.findIndex(s => s.id === segment.id);
        rail.segments.splice(segmentIndex, 1);

        if (rail.segments.length === 0 && !keepRailWhenEmpty) {
            const railIndex = rails.value.findIndex(r => r.id === rail.id);
            rails.value.splice(railIndex, 1);
        }

        // 强制取消选中
        unselectSegment(segment.id, rail.id);
        if (!skipMagnet) {
            applyMainVideoMagnet(rail);
        }
    }

    async function splitSegment({ segment, rail, keep }: { segment: WebCutSegment; rail: WebCutRail; keep?: 'left' | 'right' | 'both' }) {
        loading.value = true;
        try {
            const { sourceKey, start, end } = segment;
            const source = sources.value.get(sourceKey);
            if (!source) {
                return false;
            }

            const { type } = source;
            const splitAt = cursorTime.value;
            if (splitAt <= start || splitAt >= end) {
                return false;
            }

            // 将原始segment作为左侧部分
            const splitToKeepLeft = () => {
                segment.end = splitAt;
                resetSegmentTime(segment);
            };

            // 将原始segment作为右侧部分
            const splitToKeepRight = () => {
                segment.start = splitAt;
                resetSegmentTime(segment);
            };

            // 视频/音频：非破坏性切分（不再离屏重编码）。
            // clip.split() 返回的两半与原 clip 共享同一 localFile，引擎本身也支持通过
            // meta[type].offset 播放文件的子区间。因此拆分只需：左半段原地缩短（复用已解码的 clip，
            // 零重解码）；右半段引用同一 fileId 并把文件入点前移（push 内部用一次轻量 clip.split(offset)
            // 定位，无重编码）。避免了旧方案两次 exportBlobOffscreen（各自新建 OffscreenCanvas +
            // 解码器 + 编码器）与主画布解码并发争用 WebCodecs 导致缩略图解码超时、素材变灰的问题。
            if (type === 'video' || type === 'audio') {
                const prevMeta = source.meta[type] || {};
                const rate = source.sprite.time.playbackRate || 1;
                // 原始 segment 当前的文件入点（曾被拆分过则非 0）
                const inPoint = (prevMeta as any).offset || 0;
                // 分割点在文件中的位置：入点 + 左半段消耗的文件时长（含播放速率换算）
                const rightInPoint = inPoint + (splitAt - start) * rate;
                const rightTimelineDur = end - splitAt;
                const shouldKeepLeft = keep !== 'right';
                const shouldKeepRight = keep !== 'left';
                const src = source.fileId ? `file:${source.fileId}` : source.url as string;

                if (shouldKeepLeft) {
                    // 左半段：原地缩短，复用现有 clip/sprite，不触发任何重解码
                    segment.end = splitAt;
                    resetSegmentTime(segment);
                } else {
                    // keep === 'right'：原始 segment 不保留，删除后由下方 push 重建右半段
                    deleteSegment({ segment, rail, skipMagnet: true, keepRailWhenEmpty: true });
                }

                if (shouldKeepRight) {
                    await push(type, src, {
                        time: {
                            start: splitAt,
                            // push 内部会按 playbackRate 换算显示时长，这里传入文件时长（rate 换算后）
                            duration: rightTimelineDur * rate,
                            playbackRate: rate,
                        },
                        [type]: {
                            ...prevMeta,
                            offset: rightInPoint,
                        },
                        withRailId: rail.id,
                    });
                }
            }
            // 如果是图片，则不需要进行实际的切分，只需要调整segment的时间，并创建一个新的segment
            else if (type === 'image') {
                if (keep === 'right') {
                    splitToKeepRight();
                }
                else {
                    splitToKeepLeft();
                    const { fileId, url } = source;
                    const src = fileId ? `file:${fileId}` : url as string;
                    await push('image', src, {
                        time: {
                            start: splitAt,
                            duration: end - splitAt,
                        },
                        withRailId: rail.id,
                    });
                }
            }
            else if (type === 'text') {
                if (keep === 'right') {
                    splitToKeepRight();
                }
                else {
                    splitToKeepLeft();
                    const { text } = source;
                    // 透传原文本样式与高亮，避免切分出的右半段样式被重置为默认
                    const prevTextMeta = source.meta.text || {};
                    await push('text', text as string, {
                        time: {
                            start: splitAt,
                            duration: end - splitAt,
                        },
                        text: {
                            css: prevTextMeta.css ? clone(prevTextMeta.css) : undefined,
                            highlights: prevTextMeta.highlights ? clone(prevTextMeta.highlights) : undefined,
                        },
                        withRailId: rail.id,
                    });
                }
            }

            // 更新总时长
            updateDuration();
            applyMainVideoMagnet(rail);
            // 立即重绘当前帧，避免拆分后画布停留在旧帧
            canvas.value?.previewFrame(cursorTime.value);
            return true;
        } finally {
            loading.value = false;
        }
    }

    return {
        totalPx,
        cursorPx,
        cursorFrame,
        duration,
        totalFrameCount,
        cursorTime,
        fps,
        scale,
        moveCursorToTime,
        moveCursorToFrame,
        moveCursorToPx,
        timeToPx,
        pxToTime,
        pxOf1Frame,
        timeOf1Frame,
        enableMainVideoMagnet,
        applyMainVideoMagnet,
        scroll1,
        scroll2,
        ruler,
        resetSegmentTime,
        resizeManagerMaxHeight,
        toggleRailHidden,
        toggleRailMute,
        deleteSegment,
        splitSegment,
    };
}

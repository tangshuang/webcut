import { computed, watchEffect, watch } from 'vue';
import { useWebCutContext, useWebCutPlayer } from './index';
import { getGridFrame, getGridPixel } from '../libs/timeline';
import { WebCutSegment, WebCutRail } from '../types';
import { exportAsWavBlobOffscreen, exportBlobOffscreen } from '../libs';
import { blobToFile } from '../libs/file';
import { addFileToProject, writeFile } from '../db';
import { clone } from 'ts-fns';
import type { MP4Clip, AudioClip, ImgClip } from '@webav/av-cliper';

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
        id: projectId,
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
                return;
            }

            const { type, clip } = source;
            const splitAt = cursorTime.value;
            if (splitAt <= start || splitAt >= end) {
                return;
            }
            // 计算分割点（纳秒）
            const splitTime = splitAt - start;

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

            // 注意：原 sprite 在切分前已从 canvas 摘除（见下方各分支），
            // 避免导出期间 canvas 并发解码与 split 出来的 clip 共享同一 localFile。
            // push 内部会通过 syncSourceTickInterceptor 为新 source 注册正确的 tickInterceptor，
            // 滤镜/音量通过 meta 透传到新 source，无需再复制旧 clip 的 tickInterceptor。

            // 将切分出来的 clip 片段离屏导出为文件，导出完成后立即销毁片段，避免解码资源泄漏。
            // 同一原始 clip 的 clip.split(splitTime) 一次调用即返回 [left, right]，
            // 二者与原 clip 共享同一 localFile，因此只 split 一次并复用两半，杜绝重复消费与泄漏。
            const renderPartToFile = async (clipPart: MP4Clip | AudioClip | ImgClip) => {
                try {
                    if (type === 'video') {
                        const blob = await exportBlobOffscreen([clipPart], { type: 'video/mp4' });
                        const file = blobToFile(blob, `split-video-${Date.now()}.mp4`);
                        const fileId = await writeFile(file);
                        await addFileToProject(projectId.value, fileId);
                        return { fileId };
                    }
                    if (type === 'audio') {
                        const blob = await exportAsWavBlobOffscreen([clipPart as any]);
                        const file = blobToFile(blob, `split-audio-${Date.now()}.wav`);
                        const fileId = await writeFile(file);
                        await addFileToProject(projectId.value, fileId);
                        return { fileId };
                    }
                    return null;
                } finally {
                    clipPart.destroy();
                }
            };

            if (type === 'video' || type === 'audio') {
                const prevMeta = source.meta[type] || {};
                const leftDuration = splitAt - start;
                const rightDuration = end - splitAt;
                const shouldKeepLeft = keep !== 'right';
                const shouldKeepRight = keep !== 'left';

                // 导出前先摘除原 sprite，避免 canvas 在导出期间并发解码共享 localFile
                canvas.value?.removeSprite(source.sprite);
                // 只 split 一次，复用左右两半；不需要的那一半立即销毁
                const [leftClipPart, rightClipPart] = await clip.split(splitTime);
                if (!shouldKeepLeft) leftClipPart.destroy();
                if (!shouldKeepRight) rightClipPart.destroy();
                const leftFile = shouldKeepLeft ? await renderPartToFile(leftClipPart) : null;
                const rightFile = shouldKeepRight ? await renderPartToFile(rightClipPart) : null;

                deleteSegment({ segment, rail, skipMagnet: true, keepRailWhenEmpty: true });

                if (shouldKeepLeft && leftFile) {
                    await push(type, `file:${leftFile.fileId}`, {
                        time: {
                            start,
                            duration: leftDuration,
                        },
                        [type]: {
                            ...prevMeta,
                        },
                        withRailId: rail.id,
                    });
                }

                if (shouldKeepRight && rightFile) {
                    await push(type, `file:${rightFile.fileId}`, {
                        time: {
                            start: splitAt,
                            duration: rightDuration,
                        },
                        [type]: {
                            ...prevMeta,
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

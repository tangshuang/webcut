<script setup lang="ts">
import { MP4Clip } from '@webav/av-cliper';
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed, ref, watch, onMounted, onUnmounted, markRaw } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { useT } from '../../../i18n/hooks';
import { downloadBlob } from '../../../libs/file';
import { useWebCutManager } from '../../../hooks/manager';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';
import { mp4ClipToFramesData, createImageFromVideoFrame, exportSpritesBlobOffscreen, safeCloseFrame } from '../../../libs';
import AudioShape from '../../../components/audio-shape/index.vue';
import { useScrollBox } from '../../../components/scroll-box';
import { PerformanceMark, mark, measure } from '../../../libs/performance';
import { useWebCutTransition } from '../../../hooks/transition';

const t = useT();

// 轨道容器中图片的高度
const IMAGE_HEIGHT = 58;
const AUDIO_HEIGHT = 20;

const props = defineProps<{
    segment: WebCutSegment;
    rail: WebCutRail;
    railIndex: number;
    segmentIndex: number;
    segments: WebCutSegment[]
}>();

const { sources, loading } = useWebCutContext();
const { timeToPx, deleteSegment } = useWebCutManager();
const { push: pushHistory } = useWebCutHistory();
const { separateAudioFromVideo } = useWebCutPlayer();
const scrollBox = useScrollBox();
const { syncTransitions } = useWebCutTransition();

const thumbnails = ref<{ url: string; left: number }[]>([]);
// 在轨道中渲染后每张图片的真实宽度
const sourceImageWidth = ref(0);
// 已解码的缩略图帧，ts 为帧在 clip 内的时间（微秒）。
// clip 的内容恒从片段的文件入点开始，所以 ts 对应片段内「ts / 播放速率」处，与片段在时间轴上的位置无关
type ThumbFrame = { ts: number; blob: Blob; url?: string };
const sourceFrames = ref<ThumbFrame[]>([]);

const source = computed(() => sources.value.get(props.segment.sourceKey));
// 使用 segment.end - segment.start（响应式）来计算显示时长
const displayDuration = computed(() => {
    return props.segment.end - props.segment.start;
});
// 容器的总宽度
const totalWidth = computed(() => {
    return timeToPx(displayDuration.value);
});
// 播放速率读 meta（响应式）；sprite 是 markRaw 对象，其字段读取不建立响应式依赖
const playbackRate = computed(() => source.value?.meta.time?.playbackRate || 1);
/**
 * 片段实际展示的内容时长（clip 内时间）= 显示时长 × 播放速率。
 * 缩略图与波形只对应 clip 内 [0, contentDuration) 这一段，裁剪掉的内容不渲染
 */
const contentDuration = computed(() => displayDuration.value * playbackRate.value);
// 文件入点：变化说明 clip 被重新锚定为新的内容（裁剪/回退头部），缩略图由 source 引用变化触发重新解码
const inPoint = computed(() => source.value?.meta.video?.offset || 0);

// 已解码的波形，覆盖 clip 内 [0, decodedDuration)；渐进式解码期间为定长数组（未填充部分为静音）
const decodedWave = ref<Float32Array | null>(null);
const hasAudibleAudio = ref(false);
let initToken = 0;
// 每个 source 仅允许一次缩略图解码重试（避免真实解码失败时无限重试）
let thumbRetryUsed = false;
// 已解码覆盖的内容时长（clip 内时间，微秒）
let decodedDuration = 0;

/** 取帧的图片地址：同一帧始终复用同一个地址，裁剪、缩放后重排缩略图时不必重新创建，画面不闪烁 */
function getFrameUrl(frame: ThumbFrame) {
    if (!frame.url) {
        frame.url = URL.createObjectURL(frame.blob);
    }
    return frame.url;
}

/** 清空已解码的帧，并释放它们的图片地址（图片数据本身由帧缓存持有，地址随缓存一起释放） */
function clearFrames() {
    sourceFrames.value.forEach((frame) => {
        if (frame?.url) {
            URL.revokeObjectURL(frame.url);
        }
    });
    sourceFrames.value = [];
}
onUnmounted(clearFrames);

/**
 * 片段当前展示范围内的波形：已解码的波形比展示范围长（裁掉了尾部）时，按比例截取
 */
const waveData = computed(() => {
    const pcm = decodedWave.value;
    if (!pcm || !pcm.length || !(decodedDuration > 0)) {
        return pcm;
    }
    const count = Math.round(pcm.length * Math.min(contentDuration.value, decodedDuration) / decodedDuration);
    return count >= pcm.length ? pcm : pcm.subarray(0, Math.max(count, 1));
});

/**
 * 用已解码的帧重排缩略图（不重新解码）：帧在片段内的位置 = clip 内时间 / 播放速率，
 * 只保留落在片段实际展示范围内的帧
 */
function layoutThumbnails() {
    const rate = playbackRate.value;
    const widthPerImage = sourceImageWidth.value;
    const outs: { url: string; left: number }[] = [];
    let currEndPx = 0;
    for (const item of sourceFrames.value) {
        if (!item) {
            continue;
        }
        const itemStartPx = timeToPx(item.ts / rate);
        if (itemStartPx < currEndPx - 4) {
            continue;
        }
        if (itemStartPx >= totalWidth.value) {
            break;
        }
        outs.push({
            url: getFrameUrl(item),
            left: itemStartPx,
        });
        currEndPx = itemStartPx + widthPerImage;
    }

    thumbnails.value = outs;
}

async function initThumbnailsAndAudioWave() {
    const token = ++initToken;
    loading.value = true;
    // 先清空旧数据，避免替换视频后残留旧波形
    decodedWave.value = null;
    hasAudibleAudio.value = false;
    thumbnails.value = [];
    clearFrames();
    decodedDuration = 0;
    try {
        if (!source.value) {
            return;
        }
        const { clip } = source.value;
        if (!clip) {
            return;
        }

        await clip.ready;
        if (token !== initToken) {
            // 已被新一轮加载取代
            return;
        }

        // 算出每张图片在轨道中的实际宽度
        const originalWidth = clip.meta.width || 0;
        const originalHeight = clip.meta.height || 0;
        const realWidthPerImg = IMAGE_HEIGHT * originalWidth / originalHeight;
        sourceImageWidth.value = realWidthPerImg;

        mark(PerformanceMark.GenVideoSegmentFirstThumbStart);
        let isFirstThumbGen = false;
        // 通过iteratorCallback在迭代过程中逐一加载图片，从而提升首次渲染图片列表的性能
        const iteratorCallback = async (data: { video: VideoFrame, ts: number; index: number }) => {
            const { video, ts, index } = data;
            // 使用 JPEG 格式和 0.6 质量，大幅提升性能
            const imgBlob = await createImageFromVideoFrame(video, {
                width: realWidthPerImg,
                quality: 0.6,
                format: 'jpeg'
            });
            safeCloseFrame(video); // 关闭VideoFrame
            if (token !== initToken) {
                return;
            }

            const frame = markRaw({ ts, blob: imgBlob });
            sourceFrames.value[index] = frame;

            // 增量铺图：按帧的时间位置依次摆放，跳过与上一张重叠的帧
            let currEndPx = 0;
            for (let i = 0; i < sourceFrames.value.length; i ++) {
                const item = sourceFrames.value[i];
                if (!item) {
                    continue;
                }
                const itemStartPx = timeToPx(item.ts / playbackRate.value);
                if (itemStartPx < currEndPx - 4) {
                    continue;
                }
                currEndPx = itemStartPx + realWidthPerImg;

                if (i < index) {
                    continue;
                }
                thumbnails.value.push({
                    url: getFrameUrl(frame),
                    left: itemStartPx,
                });
                if (!isFirstThumbGen) {
                    isFirstThumbGen = true;
                    mark(PerformanceMark.GenVideoSegmentFirstThumbEnd);
                }
            }
        };

        // PCM 渐进式回调：实时更新音频波形图
        const pcmProgressCallback = (pcm: [Float32Array, Float32Array]) => {
            if (token !== initToken) {
                return;
            }
            const [leftChannelPCM, rightChannelPCM] = pcm;
            decodedWave.value = leftChannelPCM || rightChannelPCM || null;
        };

        // 只解码片段实际展示的范围：裁掉的内容不再解码、绘制。
        // 先记录将覆盖的范围再开始解码：解码期间展示范围若变小，只需重排/截取，不必重新解码
        const endTime = Math.min(contentDuration.value, clip.meta.duration);
        decodedDuration = endTime;
        const { pcm } = await mp4ClipToFramesData(clip as MP4Clip, { endTime, iteratorCallback, pcmProgressCallback });
        if (token !== initToken) {
            return;
        }
        const [leftChannelPCM, rightChannelPCM] = pcm;
        const effectivePCM = leftChannelPCM || rightChannelPCM;

        if (effectivePCM && effectivePCM.length > 0) {
            let hasSignal = false;
            // 抽样检测是否有可听信号，避免全静音时显示声形区域
            const step = Math.max(1, Math.floor(effectivePCM.length / 2000));
            for (let i = 0; i < effectivePCM.length; i += step) {
                if (Math.abs(effectivePCM[i]) > 1e-4) {
                    hasSignal = true;
                    break;
                }
            }
            hasAudibleAudio.value = hasSignal;
            decodedWave.value = hasSignal ? effectivePCM : null;
        } else {
            hasAudibleAudio.value = false;
            decodedWave.value = null;
        }

        if (import.meta.env.DEV) {
            measure(PerformanceMark.PushVideoStart, PerformanceMark.PushVideoEnd);
            measure(PerformanceMark.GenVideoClipStart, PerformanceMark.GenVideoClipEnd);
            measure(PerformanceMark.MeasureVideoSizeStart, PerformanceMark.MeasureVideoSizeEnd);
            measure(PerformanceMark.GenVideoClipEnd, PerformanceMark.VideoSpriteAddStart);
            measure(PerformanceMark.VideoSpriteAddStart, PerformanceMark.VideoSpriteAddEnd);
            measure(PerformanceMark.VideoSpriteAddEnd, PerformanceMark.VideoSegmentAdded);

            measure(PerformanceMark.GenVideoSegmentFirstThumbStart, PerformanceMark.GenVideoSegmentFirstThumbEnd);
            measure(PerformanceMark.ConvertMP4ClipToFramesStart, PerformanceMark.ConvertMP4ClipToFramesEnd);
            measure(PerformanceMark.GenImageFromVideoFrameStart, PerformanceMark.GenImageFromVideoFrameEnd);
        }
    }
    catch (e) {
        console.error(e);
        if (token !== initToken) {
            // 已被新一轮 source 取代，无需处理
        }
        else {
            hasAudibleAudio.value = false;
            decodedWave.value = null;
            // 拆分后新片段的缩略图解码会与 canvas 预览 / 离屏导出并发争用 WebCodecs 解码器，
            // 偶发抛错被静默吞掉会让素材长时间停留在灰块。此处做一次延迟重试（每个 source 仅一次）。
            if (!thumbRetryUsed) {
                thumbRetryUsed = true;
                setTimeout(() => {
                    if (token === initToken) initThumbnailsAndAudioWave();
                }, 600);
            }
        }
    } finally {
        if (token === initToken) {
            loading.value = false;
        }
    }
}

watch(source, () => {
    thumbRetryUsed = false;
    initThumbnailsAndAudioWave();
}, { immediate: true });

// 展示范围变化（裁剪尾部、变速）且 clip 没变：已解码的范围足够时只重排缩略图（波形按范围截取），
// 不够时（例如把裁掉的尾部拉回来）按新范围重新解码。
// 入点变化（裁剪/回退头部）会重建 clip，由上面的 source 引用变化接管，这里不处理
watch([contentDuration, inPoint, source], ([content, currentInPoint, currentSource], [, prevInPoint, prevSource]) => {
    if (currentSource !== prevSource || currentInPoint !== prevInPoint) {
        return;
    }
    // 变速换算存在不足一帧的取整误差，范围内的变化无需重新解码
    if (content <= decodedDuration + 1000) {
        if (sourceFrames.value.length) {
            layoutThumbnails();
        }
    }
    else {
        initThumbnailsAndAudioWave();
    }
});

// 监听总宽度变化（由缩放比例变化引起），更新缩略图位置
watch(totalWidth, () => {
    if (sourceFrames.value.length) {
        layoutThumbnails();
    }
});

const contextmenus = computed(() => [
    {
        label: t('删除'),
        key: 'delete',
    },
    {
        label: t('声音分离'),
        key: 'separate-audio',
    },
    {
        label: t('导出'),
        key: 'export',
    },
]);

async function handleSelectContextMenu(key: string) {
    if (key === 'delete') {
        deleteSegment({ segment: props.segment, rail: props.rail });
        syncTransitions(props.rail);
        await pushHistory({ title: '删除片段' });
    } else if (key === 'separate-audio') {
        await separateAudioFromVideo(props.segment.sourceKey);
        await pushHistory({ title: '声音分离' });
    } else if (key === 'export') {
        const sourceInfo = sources.value.get(props.segment.sourceKey);
        if (!sourceInfo || !sourceInfo.sprite) return;

        loading.value = true;
        try {
            await sourceInfo.clip?.ready;
            // 按片段实际展示的范围导出（裁剪、变速后导出的时长与时间轴上的片段一致）
            const blob = await exportSpritesBlobOffscreen([sourceInfo.sprite]);
            downloadBlob(blob, `video-segment-${Date.now()}.mp4`);
        } catch (error) {
            console.error('导出失败:', error);
        } finally {
            loading.value = false;
        }
    }
}

const visibleRange = ref<[number, number]>([0, 0]);
function updateVisibleRange() {
    const start = timeToPx(props.segment.start);
    const end = timeToPx(props.segment.end);

    const scrollOffset = scrollBox.getScrollOffset();
    const scrollContentSize = scrollBox.getScrollContainerSize();
    const { left: scrollLeft } = scrollOffset;
    const { width: scrollContentWidth } = scrollContentSize;

    if (scrollLeft + scrollContentWidth <= start || scrollLeft > end) {
        visibleRange.value = [0, 0];
        return;
    }

    const left = Math.max(scrollLeft - start, 0);
    const width = Math.min(end - start, scrollContentWidth);
    const right = left + width;
    visibleRange.value = [left, right];
}
onMounted(updateVisibleRange);
onMounted(() => {
    scrollBox.onScroll(updateVisibleRange);
});
// 片段区间变化（裁剪、移动）后可视范围随之更新，避免波形局部留白
watch(() => [props.segment.start, props.segment.end], updateVisibleRange);

const filteredThumbnails = computed(() => thumbnails.value.filter(Boolean));
function calcImgWidth(thumb: { left: number }, index: number) {
    if (filteredThumbnails.value[index + 1]) {
        return filteredThumbnails.value[index + 1].left - thumb.left;
    }
    // 最后一张：右侧剩余不足一张图宽时按图宽铺（超出片段的部分会被裁掉），否则延伸到片段末尾，避免末端留白
    return Math.max(sourceImageWidth.value, totalWidth.value - thumb.left);
}
</script>

<template>
    <context-menu :options="contextmenus" auto-hide v-slot="{ showContextMenus }" @select="handleSelectContextMenu">
        <div class="webcut-video-segment" @contextmenu.capture.stop="showContextMenus" :style="{ '--segment-total-width': totalWidth + 'px', '--thumb-img-height': IMAGE_HEIGHT + 'px', '--audio-wave-height': AUDIO_HEIGHT + 'px' }">
            <div
                v-for="thumbnail,index in thumbnails.filter(Boolean)"
                :key="`${props.segment.sourceKey}-${index}-${thumbnail.left}`"
                :style="{
                    left: `${thumbnail.left}px`,
                    backgroundImage: `url(${thumbnail.url})`,
                    width: calcImgWidth(thumbnail, index) + 'px',
                }"
                class="webcut-video-segment-thumbnail"
            ></div>
            <div class="webcut-video-segment-bottom" v-if="!props.rail.mute && hasAudibleAudio && waveData">
                <audio-shape
                    :height="AUDIO_HEIGHT - 4"
                    :width="totalWidth"
                    :data="waveData"
                    :visible-range="visibleRange"
                    class="webcut-video-segment-audio-shape"
                />
            </div>
        </div>
    </context-menu>
</template>

<style socped>
.webcut-video-segment {
    position: relative;
    width: 100%;
    height: 100%;
}
.webcut-video-segment-thumbnail {
    position: absolute;
    top: 0;
    height: var(--thumb-img-height);
    background-repeat: repeat-x;
    background-size: auto 100%;
    opacity: 0;
    animation: webcut-video-segment-thumbnail-fade-in 0.1s ease-in-out forwards;
}
@keyframes webcut-video-segment-thumbnail-fade-in {
    to {
        opacity: 1;
    }
}
.webcut-video-segment-bottom {
    width: 100%;
    height: var(--audio-wave-height);
    position: absolute;
    left: 0;
    bottom: 0;
    background-color: var(--webcut-grey-color);
    opacity: .8;
}
.webcut-video-segment-audio-shape {
    margin: 2px 0;
}
</style>

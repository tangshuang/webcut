<script setup lang="ts">
import { MP4Clip } from '@webav/av-cliper';
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed, ref, watch, onMounted, markRaw } from 'vue';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../hooks/i18n';
import { blobToBase64DataURL, downloadBlob } from '../../../libs/file';
import { useWebCutManager } from '../../../hooks/manager';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';
import { mp4ClipToFramesData, createImageFromVideoFrame, exportBlobOffscreen } from '../../../libs';
import AudioShape from '../../../components/audio-shape/index.vue';
import { useScrollBox } from '../../../components/scroll-box';

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

const { sources, scale } = useWebCutContext();
const { timeToPx, deleteSegment } = useWebCutManager();
const { pushHistory } = useWebCutHistory();
const scrollBox = useScrollBox();

const thumbnails = ref<{ url: string; left: number }[]>([]);
const sourceImageWidth = ref(0);
const sourceFrames = ref<{ ts: number; blob: Blob; offset: number }[]>([]);

const source = computed(() => sources.value.get(props.segment.sourceKey));
const totalDuration = computed(() => {
    const { sprite } = source.value || {};
    return sprite ? sprite.time.duration || 0 : 0;
});
const totalWidth = computed(() => {
    return timeToPx(totalDuration.value);
});

const audioF32 = ref();

watch(source, initThumbnailsAndAudioWave, { immediate: true });

watch(scale, updateThumbnails);

async function initThumbnailsAndAudioWave() {
    try {
        if (!source.value) {
            return;
        }
        const { clip, sprite } = source.value;
        if (!clip) {
            return;
        }

        const dur = sprite.time.duration;
        const totalWidth = timeToPx(dur);

        // 算出每张图片在轨道中的实际宽度
        const originalWidth = clip.meta.width || 0;
        const originalHeight = clip.meta.height || 0;
        const realWidthPerImg = IMAGE_HEIGHT * originalWidth / originalHeight;
        sourceImageWidth.value = realWidthPerImg;

        sourceFrames.value = [];
        const iteratorCallback = async (data: { video: VideoFrame, ts: number, index: number }) => {
            const { video, ts, index } = data;
            const imgBlob = await createImageFromVideoFrame(video, { width: realWidthPerImg });

            const offset = ts / dur;
            const frame = {
                ts,
                blob: imgBlob,
                offset,
            };
            sourceFrames.value[index] = markRaw(frame);
            video.close();

            let currEndPx = 0;
            for (let i = 0; i < sourceFrames.value.length; i ++) {
                const item = sourceFrames.value[i];
                if (!item) {
                    continue;
                }
                const itemStartPx = totalWidth * item.offset;
                if (itemStartPx < currEndPx - 4) {
                    continue;
                }
                currEndPx = itemStartPx + realWidthPerImg;
                if (thumbnails.value[i]) {
                    continue;
                }
                thumbnails.value[i] = {
                    url: await blobToBase64DataURL(imgBlob),
                    left: itemStartPx,
                };
            }
        }

        const { pcm } = await mp4ClipToFramesData(clip as MP4Clip, iteratorCallback);
        const [leftChannelPCM, rightChannelPCM] = pcm;

        if (leftChannelPCM) {
            audioF32.value = leftChannelPCM;
        }
        else if (rightChannelPCM) {
            audioF32.value = rightChannelPCM;
        }
        else {
            audioF32.value = null;
        }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * 通过优化的过滤算法，确保缩略图在视觉上尽可能连续拼接，同时避免过多重叠
 */
async function updateThumbnails() {
    if (!sourceFrames.value.length) {
        return;
    }

    const widthPerImage = sourceImageWidth.value;

    const outs: any[] = [{
        url: await blobToBase64DataURL(sourceFrames.value[0].blob),
        left: 0,
    }];

    let currEndPx = widthPerImage;

    for (let i = 1; i < sourceFrames.value.length; i ++) {
        const item = sourceFrames.value[i];
        if (!item) {
            continue;
        }
        const itemStartPx = totalWidth.value * item.offset;
        if (itemStartPx < currEndPx - 4) {
            continue;
        }
        outs.push({
            url: await blobToBase64DataURL(item.blob),
            left: itemStartPx,
        });
        currEndPx = itemStartPx + widthPerImage;
    }

    thumbnails.value = outs;
}

const contextmenus = computed(() => [
    {
        label: t('删除'),
        key: 'delete',
    },
    {
        label: t('导出'),
        key: 'export',
    },
]);

async function handleSelectContextMenu(key: string) {
    if (key === 'delete') {
        await pushHistory({
            action: 'materialDeleted',
            deletedFromRailId: props.rail.id,
            deletedSegmentId: props.segment.id,
            materialType: 'video',
            sourceKey: props.segment.sourceKey,
        });
        deleteSegment({ segment: props.segment, rail: props.rail });
    } else if (key === 'export') {
        try {
            const sourceInfo = sources.value.get(props.segment.sourceKey);
            if (!sourceInfo || !sourceInfo.clip) return;

            const clip = sourceInfo.clip as MP4Clip;
            await clip.ready;

            const blob = await exportBlobOffscreen([clip]);
            downloadBlob(blob, `video-segment-${Date.now()}.mp4`);
        } catch (error) {
            console.error('导出失败:', error);
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
</script>

<template>
    <context-menu :options="contextmenus" auto-hide v-slot="{ showContextMenus }" @select="handleSelectContextMenu">
        <div class="webcut-video-segment" @contextmenu.capture.stop="showContextMenus" :style="{ '--segment-total-width': totalWidth + 'px', '--thumb-img-height': IMAGE_HEIGHT + 'px', '--audio-wave-height': AUDIO_HEIGHT + 'px' }">
            <div
                v-for="thumbnail in thumbnails.filter(Boolean)"
                :key="thumbnail.left"
                :style="{
                    left: `${thumbnail.left}px`,
                    backgroundImage: `url(${thumbnail.url})`,
                    width: (totalWidth - thumbnail.left) + 'px',
                }"
                class="webcut-video-segment-thumbnail"
            ></div>
            <div class="webcut-video-segment-bottom" v-if="!props.rail.mute && audioF32">
                <audio-shape
                    :height="AUDIO_HEIGHT - 4"
                    :width="totalWidth"
                    :data="audioF32"
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
    background-size: contain;
}
.webcut-video-segment-bottom {
    width: 100%;
    height: var(--audio-wave-height);
    width: var(--segment-total-width);
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
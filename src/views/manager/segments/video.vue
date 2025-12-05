<script setup lang="ts">
import { MP4Clip } from '@webav/av-cliper';
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed, ref, watch, onMounted, markRaw } from 'vue';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../hooks/i18n';
import { blobToBase64DataURL } from '../../../libs/file';
import { useWebCutManager } from '../../../hooks/manager';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';
import { mp4ClipToFramesData, createImageFromVideoFrame } from '../../../libs';
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

watch(source, async () => {
    await initResources();
    // await updatesourceFrames();
    await updateThumbnails();
}, { immediate: true });

// watch(() => [source.value, props.rail.mute], initResources, { immediate: true });
// watch(() => props.segment, async () => {
//     await updatesourceFrames();
//     await updateThumbnails();
// }, { immediate: true });

watch(scale, updateThumbnails);


async function initResources() {
    try {
        if (!source.value) {
            return;
        }
        const { clip } = source.value;
        if (!clip) {
            return;
        }

        const { pcm, frames } = await mp4ClipToFramesData(clip as MP4Clip);
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

        if (frames) {
            const imageData: any = [];
            const dur = totalDuration.value;
            await Promise.all(frames.map(async ({ video, ts }) => {
                const imgBlob = await createImageFromVideoFrame(video, { width: 50 });
                imageData.push({
                    ts,
                    blob: imgBlob,
                    offset: ts / dur,
                });
                video.close();

                // 初始化图片在轨道中的展示宽度
                if (!sourceImageWidth.value) {
                    const firstImg = await blobToBase64DataURL(imgBlob);
                    const img = new Image();
                    img.src = firstImg;
                    await img.decode();
                    const imgWidth = img.width;
                    const imgHeight = img.height;
                    // 图片在容器中的真实高度
                    const realWidthPerImg = IMAGE_HEIGHT * imgWidth / imgHeight;
                    sourceImageWidth.value = realWidthPerImg;
                }
            }));
            sourceFrames.value = markRaw(imageData);
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
                v-for="thumbnail in thumbnails"
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
<script setup lang="ts">
import { MP4Clip } from '@webav/av-cliper';
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed, ref, watch, onMounted } from 'vue';
import { useWebCutContext } from '../../../hooks';
import { blobToBase64DataURL } from '../../../libs/file';
import { useWebCutManager } from '../../../hooks/manager';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';
import { mp4BlobToWavArrayBuffer, mp4ClipToBlob } from '../../../libs';
import AudioShape from '../../../components/audio-shape/index.vue';
import { useScrollBox } from '../../../components/scroll-box';

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
const sourceThumbnails = ref<{ ts: number; url: string; offset: number }[]>([]);
const sourceDuration = ref(0);
const totalWidth = computed(() => timeToPx(sourceDuration.value));

const source = computed(() => sources.value.get(props.segment.sourceKey));
const audioF32 = ref();

watch(() => [source.value, props.rail.mute], async () => {
    try {
        if (props.rail.mute) {
            audioF32.value = null;
            return;
        }
        if (!source.value) {
            return;
        }
        const { clip } = source.value;
        if (!clip) {
            return;
        }
        const [videoClip, audioClip] = await (clip as MP4Clip).splitTrack();
        videoClip.destroy();
        if (!audioClip) {
            return;
        }
        const mp4Blob = await mp4ClipToBlob(audioClip);
        const wavArrBuff = await mp4BlobToWavArrayBuffer(mp4Blob);
        audioF32.value = new Float32Array(wavArrBuff);
        audioClip.destroy();
    }
    catch (e) {
        console.error(e);
    }
}, { immediate: true });

watch(() => props.segment, async () => {
    await updateSourceThumbnails();
    await updateThumbnails();
}, { immediate: true });
watch(scale, updateThumbnails);

async function updateSourceThumbnails() {
    const { sourceKey } = props.segment;
    const source = sources.value.get(sourceKey);
    if (!source) {
        return;
    }

    const { clip, sprite } = source;
    if (!clip) {
        return [];
    }

    const dur = sprite.time.duration;
    sourceDuration.value = dur;

    const items = await (clip as MP4Clip).thumbnails(50, { step: dur / 200 });

    const firstImg = await blobToBase64DataURL(items[0].img);
    const img = new Image();
    img.src = firstImg;
    await img.decode();
    const imgWidth = img.width;
    const imgHeight = img.height;
    // 图片在容器中的真实高度
    const realWidthPerImg = IMAGE_HEIGHT * imgWidth / imgHeight;
    sourceImageWidth.value = realWidthPerImg;

    const changed = await Promise.all(items.map(async (item) => ({
        ts: item.ts,
        url: await blobToBase64DataURL(item.img),
        offset: item.ts / dur,
    })));
    sourceThumbnails.value = changed;
}
/**
 * 通过优化的过滤算法，确保缩略图在视觉上尽可能连续拼接，同时避免过多重叠
 */
async function updateThumbnails() {
    const widthPerImage = sourceImageWidth.value;

    const outs: any[] = [{
        url: sourceThumbnails.value[0].url,
        left: 0,
    }];

    let currEndPx = widthPerImage;

    for (let i = 1; i < sourceThumbnails.value.length; i ++) {
        const item = sourceThumbnails.value[i];
        const itemStartPx = totalWidth.value * item.offset;
        if (itemStartPx < currEndPx - 4) {
            continue;
        }
        outs.push({
            url: item.url,
            left: itemStartPx,
        });
        currEndPx = itemStartPx + widthPerImage;
    }

    thumbnails.value = outs;
}

const contextmenus = computed(() => [
    {
        label: '删除',
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
        <div class="webcut-video-segment" @contextmenu.capture.stop="showContextMenus" :style="{ '--thumb-img-height': IMAGE_HEIGHT + 'px', '--audio-wave-height': AUDIO_HEIGHT + 'px' }">
            <div
                v-for="thumbnail in thumbnails"
                :key="thumbnail.left"
                :style="{
                    left: `${thumbnail.left}px`,
                    backgroundImage: `url(${thumbnail.url})`,
                    width: sourceImageWidth * 4 + 'px',
                }"
                class="webcut-video-segment-thumbnail"
            ></div>
            <div class="webcut-video-segment-bottom" v-if="audioF32">
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
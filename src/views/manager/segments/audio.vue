<script setup lang="ts">
import { AudioClip } from '@webav/av-cliper';
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed, onMounted, ref } from 'vue';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../i18n/hooks';
import { exportSpritesAsWavBlobOffscreen } from '../../../libs';
import { downloadBlob } from '../../../libs/file';
import { useWebCutManager } from '../../../hooks/manager';
import AudioShape from '../../../components/audio-shape/index.vue';
import { useScrollBox } from '../../../components/scroll-box';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';
import { useWebCutTransition } from '../../../hooks/transition';
import { watch } from 'vue';

const t = useT();
const props = defineProps<{
    segment: WebCutSegment;
    rail: WebCutRail;
    railIndex: number;
    segmentIndex: number;
    segments: WebCutSegment[]
}>();

const { sources, loading } = useWebCutContext();
const { timeToPx, deleteSegment } = useWebCutManager();
const scrollBox = useScrollBox();
const { push: pushHistory } = useWebCutHistory();
const { syncTransitions } = useWebCutTransition();

const source = computed(() => {
    const key = props.segment.sourceKey;
    const source = sources.value.get(key);
    return source;
});
// clip 内的完整波形（从片段的文件入点到素材结尾）
const clipWave = ref<Float32Array>();

watch(source, async () => {
    if (!source.value) return;
    const { clip } = source.value;
    if (!clip) return;
    await clip.ready;
    // 等待期间 clip 已被替换（如裁剪头部后重新锚定），交给新一轮加载
    if (source.value?.clip !== clip) return;
    // 一次性加载波形图；clip 销毁后 getPCMData 返回空数组，置空避免空数据绘制
    const pcm = (clip as AudioClip).getPCMData()[0];
    clipWave.value = pcm && pcm.length ? pcm : undefined;
}, { immediate: true });

const audioOriginalDuration = computed(() => {
    // 用响应式的 segment 时间计算（与 video.vue 一致）：
    // sprite 是 markRaw 对象，其字段读取不建立响应式依赖，
    // 曾导致宽度不随时间轴状态（变速等）重算而渲染异常
    return props.segment.end - props.segment.start;
});
// 容器的总宽度
const audioWidth = computed(() => {
    return timeToPx(audioOriginalDuration.value);
});
/**
 * 片段实际展示范围内的波形。
 * clip 的内容从片段的文件入点开始，展示的是 clip 内 [0, 显示时长 × 播放速率) 这一段，
 * 所以按比例截取这一段即可，裁剪后波形与实际听到的内容一致
 */
const waveData = computed(() => {
    const pcm = clipWave.value;
    if (!pcm || !pcm.length) return undefined;
    const clipDuration = source.value?.clip.meta.duration || 0;
    const contentDuration = audioOriginalDuration.value * (source.value?.meta.time?.playbackRate || 1);
    if (!(clipDuration > 0) || contentDuration >= clipDuration) return pcm;
    return pcm.subarray(0, Math.max(1, Math.round(pcm.length * contentDuration / clipDuration)));
});
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
        deleteSegment({ segment: props.segment, rail: props.rail });
        syncTransitions(props.rail);
        await pushHistory({ title: '删除片段' });
    } else if (key === 'export') {
        const sourceInfo = sources.value.get(props.segment.sourceKey);
        if (!sourceInfo || !sourceInfo.sprite) return;

        loading.value = true;
        try {
            await sourceInfo.clip?.ready;
            // 按片段实际展示的范围导出（裁剪、变速后导出的时长与时间轴上的片段一致）
            const blob = await exportSpritesAsWavBlobOffscreen([sourceInfo.sprite]);
            downloadBlob(blob, `audio-segment-${Date.now()}.wav`);
        } catch (error) {
            console.error('导出失败:', error);
        } finally {
            loading.value = false;
        }
    }
}

const data = computed(() => {
    // 优先使用一次性提取好的 PCM（getPCMData，零额外解码、无竞态）；
    // fileId 解码只作兜底——其依赖 WebAudio 解码，AudioContext 有页面实例配额，
    // 反复挂载耗尽配额后波形会静默消失
    return waveData.value || source.value?.fileId || null;
});
</script>

<template>
    <context-menu :options="contextmenus" auto-hide v-slot="{ showContextMenus }" @select="handleSelectContextMenu">
        <div class="webcut-audio-segment" @contextmenu.capture.stop="showContextMenus">
            <audio-shape
                :height="20"
                :width="audioWidth"
                :data="data"
                :visible-range="visibleRange"
                class="webcut-audio-segment-canvas"
                v-if="source || waveData"
            />
        </div>
    </context-menu>
</template>

<style socped>
.webcut-audio-segment {
    position: relative;
    height: 100%;
}
.webcut-audio-segment-canvas {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
}
</style>

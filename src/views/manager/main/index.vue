<script setup lang="ts">
import { WebCutRail, WebCutSegment } from '../../../types';
import VideoSegment from '../segments/video.vue';
import AudioSegment from '../segments/audio.vue';
import ImageSegment from '../segments/image.vue';
import TextSegment from '../segments/text.vue';
import { useWebCutContext } from '../../../hooks';
import { computed } from 'vue';

const props = defineProps<{
    rail: WebCutRail;
    segment: WebCutSegment;
    railIndex: number;
    segmentIndex: number;
    segments: WebCutSegment[];
}>();

const { modules } = useWebCutContext();
const Component = computed(() => {
    const regMod = [...modules.value.values()].find((item) => item.managerConfig?.is(props.rail));
    let comp = regMod?.managerConfig?.segment?.component;
    if (!comp) {
        const map = {
            video: VideoSegment,
            audio: AudioSegment,
            image: ImageSegment,
            text: TextSegment,
        };
        // @ts-ignore
        comp = map[props.rail.type];
    }
    return comp;
});
</script>

<template>
    <div class="webcut-manager-segment">
        <component :is="Component" :segment="segment" :rail="rail" :railIndex="railIndex" :segmentIndex="segmentIndex" :segments="segments"></component>
    </div>
</template>

<style scoped>
.webcut-manager-segment {
    width: 100%;
    height: 100%;
}
</style>
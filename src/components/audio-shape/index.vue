<script setup lang="ts">
import { isEqual, throttle } from 'ts-fns';
import { ref, watch, nextTick, computed } from 'vue';

const props = defineProps<{
    height: number;
    width: number;
    data: Float32Array;
    visibleRange?: [left: number, right: number];
}>();

const container = ref();
const canvas = ref();
const canvasWidth = computed(() => {
    if (props.visibleRange) {
        const [start, end] = props.visibleRange;
        const rangeWidth = end - start;
        return rangeWidth > props.width ? props.width : rangeWidth;
    }
    return props.width;
});
const canvasLeft = computed(() => {
    if (props.visibleRange) {
        const [start] = props.visibleRange;
        return start;
    }
    return 0;
});

async function drawWave() {
    if (!props.data || !canvas.value || !props.width || !props.height) {
        return;
    }

    const visibleRange = props.visibleRange;
    const visibleStart = visibleRange ? visibleRange[0] : 0;
    const visibleEnd = visibleRange ? visibleRange[1] : props.width;

    const audioFloatArray = props.data;
    const audioBufferLength = audioFloatArray.length;

    const canvasContext = canvas.value.getContext('2d');
    const canvasWidth = canvas.value.width;
    const canvasHeight = canvas.value.height;

    canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);

    const step = Math.floor(audioBufferLength / props.width);
    const maxHeight = canvas.value.height;

    canvasContext.beginPath();

    for (let i = visibleStart; i <= visibleEnd; i++) {
        const index = i * step;
        const value = audioFloatArray[index] * maxHeight;
        const x = i;
        const y = canvasHeight / 2 + value;
        if (i === visibleStart) {
            canvasContext.moveTo(x - visibleStart, y);
        }
        else {
            canvasContext.lineTo(x - visibleStart, y);
        }
    }

    canvasContext.strokeStyle = 'white';
    canvasContext.lineWidth = 1;
    canvasContext.stroke();
}

watch(() => [props.width, props.height, props.data], () => {
    if (!props.width || !props.height || !props.data) {
        return;
    }

    nextTick(() => {
        drawWave();
    });
}, { immediate: true });

const redraw = throttle((next, prev) => {
    if (next && !isEqual(next, prev)) {
        drawWave();
    }
}, 16);
watch(() => props.visibleRange, redraw);
</script>

<template>
    <div class="audio-shape-container" :style="{ width: props.width + 'px', height: props.height + 'px' }" ref="container">
        <canvas class="audio-shape-canvas" ref="canvas" :height="props.height" :width="canvasWidth" :style="{ left: canvasLeft + 'px' }"></canvas>
    </div>
</template>

<style scoped lang="less">
.audio-shape-container {
    position: relative;
}
.audio-shape-canvas {
    position: absolute;
    left: 0;
    top: 0;
    display: block;
    line-height: 1;
}
</style>
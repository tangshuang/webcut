<script setup lang="ts">
import { watch, ref, watchEffect, onBeforeUnmount, onMounted, inject, nextTick, computed } from 'vue';
import { useWebCutPlayer, useWebCutContext } from '../../hooks';
import { Evt } from '../../libs/evt';

const props = defineProps<{
    /** 最大宽度 */
    maxWidth?: number;
    /** 最大高度 */
    maxHeight?: number;
}>();

const { viewport, width, height, player, editTextState, currentSource } = useWebCutContext();
const { init, destroy } = useWebCutPlayer();
const canvasSizeRef = inject('videoCanvasSizeRef', null);

const box = ref();
const canvasMaxWidth = ref(0);
const canvasMaxHeight = ref(0);
const canvasScale = ref(1);

const isOnlySelectable = computed(() => {
    if (!currentSource.value) {
        return false;
    }
    const { sprite } = currentSource.value;
    return sprite.interactable === 'selectable';
});

watch(viewport, (el) => {
    if (el) {
        init();
    }
    else {
        destroy();
    }
}, { immediate: true });

function fitBoxSize() {
    if (!box.value) {
        return;
    }

    const canvasWidth = width.value;
    const canvasHeight = height.value;

    const { width: outerWidth, height: outerHeight } = box.value.getBoundingClientRect();
    const scale = Math.min(
        outerWidth / canvasWidth,
        outerHeight / canvasHeight,
        props.maxWidth ? props.maxWidth / canvasWidth : 1,
        props.maxHeight ? props.maxHeight / canvasHeight : 1,
    );
    if (scale < 1) {
        canvasMaxWidth.value = canvasWidth * scale;
        canvasMaxHeight.value = canvasHeight * scale;
    }
    canvasScale.value = scale;

    if (canvasSizeRef) {
        nextTick(() => {
            const { width, height } = viewport.value!.getBoundingClientRect();
            // @ts-ignore
            canvasSizeRef.value = {
                width,
                height,
            };
        });
    }
}

watchEffect(fitBoxSize);

onMounted(() => {
    window.addEventListener('resize', fitBoxSize);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', fitBoxSize);
    destroy();
});

const evt = new Evt();
const exports = {
    fitBoxSize,
    on: evt.on.bind(evt),
    off: evt.off.bind(evt),
    once: evt.once.bind(evt),
    emit: evt.emit.bind(evt),
    box,
    viewport,
    canvasScale,
    canvasSize: canvasSizeRef,
};
player.value = exports;
</script>

<template>
    <div class="webcut-screen-box" ref="box" :class="{
        'webcut-screen-box--text-edit-active': editTextState?.isActive,
        'webcut-screen-box--only-selectable': isOnlySelectable,
    }">
        <div class="webcut-screen-viewport" ref="viewport" :style="{
            width: width + 'px',
            height: height + 'px',
            maxWidth: canvasMaxWidth ? canvasMaxWidth + 'px' : undefined,
            maxHeight: canvasMaxHeight ? canvasMaxHeight + 'px' : undefined,
        }"></div>
        <slot></slot>
    </div>
</template>

<style scoped>
.webcut-screen-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.webcut-screen-box--text-edit-active :deep(.sprite-rect) {
    display: none;
}
.webcut-screen-box :deep(.sprite-rect:has(> div[class^="ctrl-key-"] > svg)) {
    cursor: default !important;
}
.webcut-screen-box :deep(.sprite-rect > div[class^="ctrl-key-"] > svg) {
    display: none !important;
}
</style>
<script setup lang="ts">
import { NIcon, NPopover, NButton, useLoadingBar } from 'naive-ui';
import { SplitVertical16Filled } from '@vicons/fluent';
import { useWebCutContext } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';
import { useT } from '../../../hooks/i18n';
import { computed } from 'vue';

const { rails, selected, current, cursorTime } = useWebCutContext();
const { splitSegment } = useWebCutManager();
const loadingBar = useLoadingBar();
const t = useT();

const currentSelected = computed(() => {
    if (!current.value) {
        return;
    }
    const selectedItem = selected.value.find(item => item.segmentId === current.value)!;
    const { railId, segmentId } = selectedItem;
    const rail = rails.value.find(item => item.id === railId);
    if (!rail) {
        return;
    }
    const segment = rail.segments.find(item => item.id === segmentId);
    if (!segment) {
        return;
    }
    return { rail, segment };
});
const canSplit = computed(() => {
    if (!currentSelected.value) {
        return false;
    }
    const { segment } = currentSelected.value;
    const time = cursorTime.value;
    const { start, end } = segment;
    return time > start && time < end;
});

async function handleSplit() {
    if (!currentSelected.value) {
        return;
    }

    try {
        loadingBar.start();
        const { segment, rail } = currentSelected.value;
        await splitSegment({ segment, rail });
        loadingBar.finish();
    }
    catch (e) {
        console.error(e);
        loadingBar.error();
    }
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary size="small" :focusable="false" @click="handleSplit" class="webcut-tool-button" :disabled="!current || !canSplit">
                <template #icon>
                    <n-icon :component="SplitVertical16Filled" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>{{ t('分割当前选中') }}</small>
    </n-popover>
</template>

<style scoped>
:global(.webcut-tooltip) {
    padding: 4px 8px !important;
}
.webcut-tool-button {
    padding: 0;
    width: 24px;
    height: 24px;
}
</style>

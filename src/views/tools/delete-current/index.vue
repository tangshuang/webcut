<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { Delete } from '@vicons/carbon';
import { useWebCutContext } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';

const { rails, selected, current } = useWebCutContext();
const { deleteSegment } = useWebCutManager();

function handleDelete() {
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
    deleteSegment({ segment, rail });
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary size="small" :focusable="false" @click="handleDelete" class="webcut-tool-button" :disabled="!current">
                <template #icon>
                    <n-icon :component="Delete" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>删除当前选中</small>
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

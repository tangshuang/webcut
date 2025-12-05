<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { Delete } from '@vicons/carbon';
import { useWebCutContext } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';
import { useT } from '../../../hooks/i18n';

const { rails, selected, current } = useWebCutContext();
const { deleteSegment } = useWebCutManager();
const t = useT();

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
        <small>{{ t('删除当前选中') }}</small>
    </n-popover>
</template>

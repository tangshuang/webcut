<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { Delete } from '@vicons/carbon';
import { useWebCutContext } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';
import { useWebCutHistory } from '../../../hooks/history';
import { useT } from '../../../hooks/i18n';

const { rails, current, sources } = useWebCutContext();
const { deleteSegment } = useWebCutManager();
const { push: pushHistory } = useWebCutHistory();
const t = useT();

async function handleDelete() {
    if (!current.value || !current.value.segmentId) {
        return;
    }
    const { segmentId, railId } = current.value;
    const rail = rails.value.find(item => item.id === railId);
    if (!rail) {
        return;
    }
    const segment = rail.segments.find(item => item.id === segmentId);
    if (!segment) {
        return;
    }

    const source = sources.value.get(segment.sourceKey);
    if (source) {
        await pushHistory();
    }

    deleteSegment({ segment, rail });
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary size="small" :focusable="false" @click="handleDelete" class="webcut-tool-button" :disabled="!current || !current.segmentId">
                <template #icon>
                    <n-icon :component="Delete" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>{{ t('删除当前选中') }}</small>
    </n-popover>
</template>

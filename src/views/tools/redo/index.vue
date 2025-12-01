<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { Redo } from '@vicons/carbon';
import { useWebCutHistory } from '../../../hooks/history';

const { canRedo, redo } = useWebCutHistory();
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary size="small" :focusable="false" @click="redo" class="webcut-tool-button" :disabled="!canRedo">
                <template #icon>
                    <n-icon :component="Redo" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>重做</small>
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

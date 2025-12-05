<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { Broom16Regular } from '@vicons/fluent';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../hooks';

const { selected, current } = useWebCutContext();
const t = useT();

function handleClear() {
    selected.value = [];
    current.value = null;
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary :focusable="false" @click="handleClear" class="webcut-tool-button" :disabled="selected.length === 0">
                <template #icon>
                    <n-icon :component="Broom16Regular" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>{{ t('清除选中') }}</small>
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

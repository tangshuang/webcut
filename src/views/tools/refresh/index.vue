<script setup lang="ts">
import { NIcon, NPopover, NButton } from 'naive-ui';
import { ArrowClockwise16Regular } from '@vicons/fluent';
import { useWebCutHistory } from '../../../hooks/history';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../i18n/hooks';

const { loading } = useWebCutContext();
const { refreshRender } = useWebCutHistory();
const t = useT();

async function handleRefresh() {
    await refreshRender();
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button quaternary :focusable="false" @click="handleRefresh" class="webcut-tool-button" :loading="loading">
                <template #icon>
                    <n-icon :component="ArrowClockwise16Regular" size="16px"></n-icon>
                </template>
            </n-button>
        </template>
        <small>{{ t('刷新轨道渲染') }}</small>
    </n-popover>
</template>

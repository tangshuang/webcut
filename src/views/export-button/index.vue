<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui';
import { Export } from '@vicons/carbon';
import { useWebCutContext, useWebCutPlayer } from '../../hooks';
import { useT } from '../../i18n/hooks';
import { useWebCutToast } from '../../hooks/toast';
import { ref, nextTick } from 'vue';

const { download } = useWebCutPlayer();
const { sprites } = useWebCutContext();
const t = useT();
const toast = useWebCutToast();

const loading = ref(false);
const isExporting = ref(false);

async function handleExport() {
    if (isExporting.value) {
        return;
    }
    
    isExporting.value = true;
    loading.value = true;
    
    await nextTick();
    
    toast.loading(t('正在导出...'));
    
    try {
        await download();
    } finally {
        toast.hide();
        loading.value = false;
        isExporting.value = false;
    }
}
</script>

<template>
    <n-button v-bind="$attrs" type="primary" size="tiny" @click="handleExport" :disabled="sprites.length === 0 || loading" class="webcut-export-button" :loading="loading">
        <template #icon>
            <n-icon><Export /></n-icon>
        </template>
        <slot>{{ t('导出') }}</slot>
    </n-button>
</template>

<style scoped lang="less">
@import "../../styles/export-button.less";
</style>

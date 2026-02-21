<script setup lang="ts">
import { NModal, NButton } from 'naive-ui';
import ExportPanel from './export-panel.vue';
import WebCutThemeBox from '../../views/theme-box/index.vue';
import { useT } from '../../i18n/hooks';

const t = useT();
const show = defineModel<boolean>('show');

function handleExportSuccess() {
    setTimeout(() => {
        show.value = false;
    }, 500);
}
</script>

<template>
    <n-modal v-model:show="show" style="width: 360px; max-width: 90vw;" :mask-closable="false">
        <WebCutThemeBox>
            <ExportPanel @export-success="handleExportSuccess">
                <template #buttons="{ isExporting }">
                    <n-button :disabled="isExporting" secondary @click="show = false">
                        {{ t('取消') }}
                    </n-button>
                </template>
            </ExportPanel>
        </WebCutThemeBox>
    </n-modal>
</template>

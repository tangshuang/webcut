<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import ExportModal from './export-modal.vue';
import { useWebCutContext } from '../../hooks';
import { useT } from '../../i18n/hooks';
import { ArrowDownload16Regular } from '@vicons/fluent';

const t = useT();
const { sprites } = useWebCutContext();

const showModal = ref(false);

const showExportModal = () => {
  showModal.value = true;
};
</script>

<template>
  <div class="webcut-advance-export">
    <slot name="trigger" :open="showExportModal">
      <n-button
        type="primary"
        size="tiny"
        @click="showExportModal"
        class="webcut-export-button"
        :disabled="sprites.length === 0"
      >
        <template #icon>
          <n-icon><ArrowDownload16Regular /></n-icon>
        </template>
        {{ t('高级导出') }}
      </n-button>
    </slot>
    <export-modal v-model:show="showModal" />
  </div>
</template>

<style scoped lang="less">
@import "../../styles/export-button.less";
.webcut-advance-export {
  display: contents;
}
</style>
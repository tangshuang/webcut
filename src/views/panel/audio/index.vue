<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { NForm, NFormItem, NSlider, NInputNumber, NAlert, NButton } from 'naive-ui';
import { useT } from '../../../hooks/i18n';
import { useWebCutHistory } from '../../../hooks/history';
import { throttle } from 'ts-fns';

const { currentSource } = useWebCutContext();
const { syncSourceMeta, syncSourceTickInterceptor } = useWebCutPlayer();
const { push: pushHistory } = useWebCutHistory();
const t = useT();

const volume = ref(1);
const isSyncing = ref(false);

// 节流保存历史记录
const throttledPushHistory = throttle(pushHistory, 500);

// 同步音量数据
function syncVolumeToForm() {
  if (!currentSource.value) return;

  isSyncing.value = true;
  const audioVolume = currentSource.value.meta.audio?.volume;
  volume.value = audioVolume ?? 1;

  nextTick(() => {
    isSyncing.value = false;
  });
}

// 监听当前源变化
watch(() => currentSource.value, () => {
  syncVolumeToForm();
}, { immediate: true });

// 监听音量变化
watch(volume, (newVolume) => {
  if (!currentSource.value || isSyncing.value) return;

  // 更新 meta 数据
  syncSourceMeta(currentSource.value, {
    audio: { ...currentSource.value.meta.audio, volume: newVolume }
  });

  // 应用实时音量调节
  syncSourceTickInterceptor(currentSource.value.key);

  // 保存历史记录
  throttledPushHistory();
});

// 重置音量
function resetVolume() {
  if (!currentSource.value) return;
  volume.value = 1;
  syncSourceTickInterceptor(currentSource.value.key);
}
</script>

<template>
  <n-form size="small" label-placement="left" :label-width="60" label-align="right" class="webcut-panel-form">
    <n-alert class="webcut-message" v-if="!currentSource" type="warning">{{ t('请先选择音频片段') }}</n-alert>
    <n-form-item v-else :label="t('音量')">
      <n-slider v-model:value="volume" :min="0" :max="4" :step="0.01"></n-slider>
      <n-input-number v-model:value="volume" :min="0" :max="4" :step="0.01" :precision="2"></n-input-number>
      <n-button size="small" secondary @click="resetVolume" style="margin-left: 8px;">{{ t('重置') }}</n-button>
    </n-form-item>
  </n-form>
</template>

<style scoped>
.webcut-panel-form {
  padding: 8px;
}
.webcut-message {
  margin-bottom: 8px;
}
</style>
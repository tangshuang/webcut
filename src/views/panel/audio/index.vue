<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { NForm, NFormItem, NSlider, NInputNumber, NAlert, NButton } from 'naive-ui';
import { useT } from '../../../i18n/hooks';
import { useWebCutHistory } from '../../../hooks/history';

const { currentSource } = useWebCutContext();
const { syncSourceMeta, repairAudioPitchByPlaybackRate, syncSourceTickInterceptor } = useWebCutPlayer();
const { push: pushHistory, touch: touchHistory } = useWebCutHistory();
const t = useT();

const volume = ref(1);
const playbackRate = ref(1);
const isSyncing = ref(false);
const fixingPitch = ref(false);
const canRepairPitch = computed(() => !!currentSource.value && Math.abs(playbackRate.value - 1) > 1e-6 && !fixingPitch.value);

// 手势事务记账：同一属性的连续调整静默后合并为一条历史
const touchVolumeHistory = () => touchHistory({ title: '调整音频音量', mergeKey: `audio:${currentSource.value?.key}:volume` });
const touchPlaybackRateHistory = () => touchHistory({ title: '调整播放速度', mergeKey: `audio:${currentSource.value?.key}:rate` });

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

// 同步播放速度数据
function syncPlaybackRateToForm() {
  if (!currentSource.value) return;

  isSyncing.value = true;
  const rate = currentSource.value.meta.time?.playbackRate;
  playbackRate.value = rate ?? 1;

  nextTick(() => {
    isSyncing.value = false;
  });
}

// 监听当前源变化
watch(() => currentSource.value, () => {
  syncVolumeToForm();
  syncPlaybackRateToForm();
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
  touchVolumeHistory();
});

// 监听播放速度变化
watch(playbackRate, (newRate) => {
  if (!currentSource.value || isSyncing.value) return;

  // 更新 meta 数据和 sprite.time.playbackRate
  syncSourceMeta(currentSource.value, {
    time: { playbackRate: newRate }
  });

  // 保存历史记录
  touchPlaybackRateHistory();
});

// 重置音量
function resetVolume() {
  if (!currentSource.value) return;
  volume.value = 1;
  syncSourceTickInterceptor(currentSource.value.key);
}

// 重置播放速度
function resetPlaybackRate() {
  if (!currentSource.value) return;
  playbackRate.value = 1;
}

async function repairPitch() {
  if (!currentSource.value || !canRepairPitch.value) return;
  fixingPitch.value = true;
  try {
    await repairAudioPitchByPlaybackRate(currentSource.value.key);
    playbackRate.value = 1;
    await pushHistory({ title: t('声调修复') });
  } finally {
    fixingPitch.value = false;
  }
}
</script>

<template>
  <n-form size="small" label-placement="left" :label-width="60" label-align="right" class="webcut-panel-form">
    <n-alert class="webcut-message" v-if="!currentSource" type="warning">{{ t('请先选择音频片段') }}</n-alert>
    <template v-else>
      <n-form-item :label="t('音量')">
        <n-slider v-model:value="volume" :min="0" :max="4" :step="0.01"></n-slider>
        <n-input-number v-model:value="volume" :min="0" :max="4" :step="0.01" :precision="2"></n-input-number>
        <n-button size="small" secondary @click="resetVolume" style="margin-left: 8px;">{{ t('重置') }}</n-button>
      </n-form-item>
      <n-form-item :label="t('速度')">
        <div class="webcut-form-item-column">
          <div class="webcut-form-item-speed">
            <n-slider v-model:value="playbackRate" :min="0.25" :max="4" :step="0.01"></n-slider>
            <n-input-number v-model:value="playbackRate" :min="0.25" :max="4" :step="0.01" :precision="2"></n-input-number>
            <n-button size="small" secondary @click="resetPlaybackRate" style="margin-left: 8px;">{{ t('重置') }}</n-button>
          </div>
          <n-button type="primary" text :disabled="!canRepairPitch" @click="repairPitch">{{ fixingPitch ? t('处理中...') : t('声调修复') }}</n-button>
        </div>
      </n-form-item>
    </template>
  </n-form>
</template>

<style scoped>
.webcut-panel-form {
  padding: 8px;
}
.webcut-message {
  margin-bottom: 8px;
}
.webcut-form-item-speed {
  width: 100%;
  display: flex;
  align-items: center;
}
.webcut-form-item-column {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>

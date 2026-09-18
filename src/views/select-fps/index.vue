<script setup lang="ts">
import { computed, h } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Fps3048Filled, Fps6016Regular, Fps12020Regular } from '@vicons/fluent';
import { useWebCutContext } from '../../hooks';
import { FPS_OPTIONS } from '../../constants';
import { useT } from '../../i18n/hooks';

const props = defineProps<{
  /** 是否展示帧率文字 */
  displayFps?: boolean;
}>();

const t = useT();
const { fps, updateByFps } = useWebCutContext();

// 按帧率档位取阶梯图标：≤30 低帧率、31~60 中帧率、>60 高帧率
function getFpsIcon(value: number) {
  if (value <= 30) return Fps3048Filled;
  if (value <= 60) return Fps6016Regular;
  return Fps12020Regular;
}

// 帧率选项
const FpsOptions = computed(() =>
  FPS_OPTIONS.map((value) => ({
    label: `${value}FPS`,
    key: value,
    icon: () => h(NIcon, null, { default: () => h(getFpsIcon(value)) }),
    disabled: fps.value === value,
  })),
);

// 处理帧率选择
async function handleSelectFps(value: number) {
  await updateByFps(value);
}
</script>

<template>
    <NDropdown trigger="click" placement="top-end" size="small" :options="FpsOptions" @select="handleSelectFps">
        <NButton text :focusable="false" size="tiny" :title="t('帧率')">
            <template #icon>
                <NIcon>
                <Fps12020Regular />
                </NIcon>
            </template>
            <span v-if="props.displayFps">{{ fps }}FPS</span>
        </NButton>
    </NDropdown>
</template>

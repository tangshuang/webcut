<script setup lang="ts">
import { computed, h } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Hd16Regular } from '@vicons/fluent';
import { useWebCutContext } from '../../hooks';
import { RESOLUTIONS } from '../../constants';
import { WebCutResolution } from '../../types';
import { useT } from '../../i18n/hooks';

const props = defineProps<{
  /** 是否展示分辨率文字 */
  displayResolution?: boolean;
}>();

const t = useT();
const { resolution, updateByResolution } = useWebCutContext();

// 分辨率选项
const ResolutionOptions = computed(() =>
  RESOLUTIONS.map((value) => ({
    label: value,
    key: value,
    icon: () => h(NIcon, null, { default: () => h(Hd16Regular) }),
    disabled: resolution.value === value,
  })),
);

// 处理分辨率选择
async function handleSelectResolution(value: WebCutResolution) {
  await updateByResolution(value);
}
</script>

<template>
    <NDropdown trigger="click" placement="top-end" size="small" :options="ResolutionOptions" @select="handleSelectResolution">
        <NButton text :focusable="false" size="tiny" :title="t('分辨率')">
            <template #icon>
                <NIcon>
                <Hd16Regular />
                </NIcon>
            </template>
            <span v-if="props.displayResolution">{{ resolution }}</span>
        </NButton>
    </NDropdown>
</template>

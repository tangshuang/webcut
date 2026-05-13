<script setup lang="ts">
import { computed } from 'vue';
import { NPopover, NButton, NIcon } from 'naive-ui';
import { Compare } from '@vicons/carbon';
import { useWebCutManager } from '../../../hooks/manager';
import { useWebCutThemeColors } from '../../../hooks';
import { useT } from '../../../i18n/hooks';

const { enableMainVideoMagnet, applyMainVideoMagnet } = useWebCutManager();
const { themeColors } = useWebCutThemeColors();
const t = useT();
const isActive = computed(() => enableMainVideoMagnet.value);
const activeIconStyle = computed(() => {
    if (!isActive.value) {
        return undefined;
    }
    return { color: themeColors.value.primaryColor };
});

function handleToggle() {
    enableMainVideoMagnet.value = !enableMainVideoMagnet.value;
    if (enableMainVideoMagnet.value) {
        applyMainVideoMagnet();
    }
}
</script>

<template>
    <n-popover :delay="200" class="webcut-tooltip">
        <template #trigger>
            <n-button
                quaternary
                size="small"
                :focusable="false"
                class="webcut-tool-button webcut-tool-button--magnet"
                :class="{ 'webcut-tool-button--active': isActive }"
                @click="handleToggle"
            >
                <template #icon>
                    <n-icon :component="Compare" size="16px" class="webcut-tool-button--magnet-icon" :style="activeIconStyle"></n-icon>
                </template>
            </n-button>
        </template>
        <small>{{ t('主轨视频片段首尾连续吸附') }}</small>
    </n-popover>
</template>

<style scoped>
.webcut-tool-button--magnet {
    border-radius: 4px;
    border: 1px solid transparent;
    transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}

.webcut-tool-button--active {
    background-color: var(--webcut-theme-opacity-color);
}

.webcut-tool-button--active .webcut-tool-button--magnet-icon {
    color: var(--primary-color);
}
</style>

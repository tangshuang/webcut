<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NIcon, NPopover } from 'naive-ui';
import { ArrowSwap20Regular } from '@vicons/fluent';
import { formatTime } from '../../libs';
import { useWebCutContext } from '../../hooks';
import { useWebCutManager } from '../../hooks/manager';
import { useT } from '../../i18n/hooks';

const t = useT();
const { id, cursorTime, duration } = useWebCutContext();
const { cursorFrame, totalFrameCount } = useWebCutManager();

// 进度展示模式：time 时间 / frame 帧，按项目持久化（参考 dock 展开态持久化）
const timeModeStorageKey = computed(() => `WEBCUT_TIME_MODE:${id.value}`);
const mode = ref<'time' | 'frame'>(
    (() => {
        try {
            return localStorage.getItem(`WEBCUT_TIME_MODE:${id.value}`) === 'frame' ? 'frame' : 'time';
        } catch {
            return 'time';
        }
    })(),
);

function toggleMode() {
    mode.value = mode.value === 'time' ? 'frame' : 'time';
    try {
        localStorage.setItem(timeModeStorageKey.value, mode.value);
    } catch {}
}

// 帧号左补零，位数与总帧数保持一致（如 0001/3234）
const padFrame = (frame: number) => String(frame).padStart(String(totalFrameCount.value).length, '0');
const currentFrameText = computed(() => padFrame(cursorFrame.value));
</script>

<template>
    <div class="webcut-time-clock">
        <template v-if="mode === 'time'">
            <span class="webcut-time-clock-text">{{ formatTime(cursorTime) }}</span>
            <span class="webcut-time-clock-separator">/</span>
            <span class="webcut-time-clock-text">{{ formatTime(duration) }}</span>
        </template>
        <template v-else>
            <span class="webcut-time-clock-text">{{ currentFrameText }}</span>
            <span class="webcut-time-clock-separator">/</span>
            <span class="webcut-time-clock-text">{{ totalFrameCount }}</span>
            <span class="webcut-time-clock-unit">F</span>
        </template>
        <NPopover :delay="200" placement="top" class="webcut-tooltip">
            <template #trigger>
                <NButton text :focusable="false" size="tiny" class="webcut-time-clock-toggle" @click="toggleMode">
                    <template #icon>
                        <NIcon>
                            <ArrowSwap20Regular />
                        </NIcon>
                    </template>
                </NButton>
            </template>
            <small>{{ t('时间/帧切换') }}</small>
        </NPopover>
    </div>
</template>

<style scoped>
.webcut-time-clock {
    display: flex;
    align-items: center;
    font-size: var(--webcut-font-size-tiny);
}
.webcut-time-clock-text {
    display: inline-block;
    font-variant-numeric: tabular-nums;
}
.webcut-time-clock-separator {
    margin: 0 4px;
}
.webcut-time-clock-unit {
    margin-left: 2px;
}
.webcut-time-clock-toggle {
    margin-left: 4px;
}
</style>

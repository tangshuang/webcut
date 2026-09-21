<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { NPopover, NButton, NIcon, NSlider } from 'naive-ui';
import { ZoomIn24Regular } from '@vicons/fluent';
import { useWebCutContext } from '../../hooks';
import { useT } from '../../i18n/hooks';

const props = defineProps<{
  /** 是否展示缩放倍率文字 */
  displayZoom?: boolean;
}>();

const t = useT();
const { canvasZoom, evt } = useWebCutContext();

// 受控展示：画布开始拖拽平移时立即收起，避免遮挡视线
const showPopover = ref(false);

function handleCanvasPanStart() {
    showPopover.value = false;
}

onMounted(() => {
    evt.value?.on('canvasPanStart', handleCanvasPanStart);
});

onBeforeUnmount(() => {
    evt.value?.off('canvasPanStart', handleCanvasPanStart);
});

// 缩放范围 25% ~ 400%，步长 5%
const MIN_PERCENT = 25;
const MAX_PERCENT = 400;
const STEP_PERCENT = 5;

const percent = computed({
  get: () => Math.round(canvasZoom.value * 100),
  set: (value: number) => {
    const next = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
    canvasZoom.value = next / 100;
  },
});

// 在 popover 上滚动鼠标滚轮调节缩放（上滚放大、下滚缩小）
function handleWheel(e: WheelEvent) {
  e.preventDefault();
  percent.value = percent.value + (e.deltaY < 0 ? STEP_PERCENT : -STEP_PERCENT);
}

// 重置为适配屏幕（100%）
function handleReset() {
  canvasZoom.value = 1;
}
</script>

<template>
    <NPopover v-model:show="showPopover" trigger="click" placement="top-end" :show-arrow="false">
        <template #trigger>
            <NButton text :focusable="false" size="tiny" :title="t('缩放')">
                <template #icon>
                    <NIcon>
                        <ZoomIn24Regular />
                    </NIcon>
                </template>
                <span v-if="props.displayZoom">{{ percent }}%</span>
            </NButton>
        </template>
        <div class="webcut-zoom-popover" @wheel.prevent="handleWheel">
            <div class="webcut-zoom-popover-header">
                <span>{{ t('缩放') }}</span>
                <span class="webcut-zoom-popover-value">{{ percent }}%</span>
            </div>
            <NSlider
                v-model:value="percent"
                class="webcut-zoom-popover-slider"
                :min="MIN_PERCENT"
                :max="MAX_PERCENT"
                :step="STEP_PERCENT"
                :tooltip="false"
            ></NSlider>
            <div class="webcut-zoom-popover-footer">
                <span class="webcut-zoom-popover-range">{{ MIN_PERCENT }}% ~ {{ MAX_PERCENT }}%</span>
                <NButton size="tiny" quaternary :disabled="percent === 100" @click="handleReset">{{ t('重置') }}</NButton>
            </div>
        </div>
    </NPopover>
</template>

<style scoped>
.webcut-zoom-popover {
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 0;
}
.webcut-zoom-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
}
.webcut-zoom-popover-value {
    font-variant-numeric: tabular-nums;
}
.webcut-zoom-popover-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.webcut-zoom-popover-range {
    font-size: 11px;
    opacity: 0.6;
    padding-left: 8px;
}
</style>

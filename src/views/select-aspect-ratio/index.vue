<script setup lang="ts">
import { ref, h, computed, watch } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import {
    Tablet20Regular,
    Tablet32Regular,
    Phone16Regular,
    Phone24Regular,
    Square16Regular,
    PhoneDesktop28Regular,
} from '@vicons/fluent';
import { useWebCutContext } from '../../hooks';

const props = defineProps<{
  /** 是否展示比例文字 */
  displayAspect?: boolean;
}>();

const { width, height } = useWebCutContext();

// 长宽比状态
const aspectRatio = ref('4:3');
// 定义长宽比选项
const AspectRatioOptions = computed(() => [
  {
    label: '21:9',
    key: '21:9',
    icon: () => h(NIcon, null, { default: () => h(Tablet20Regular) }),
    disabled: aspectRatio.value === '21:9',
  },
  {
    label: '16:9',
    key: '16:9',
    icon: () => h(NIcon, null, { default: () => h(Tablet20Regular) }),
    disabled: aspectRatio.value === '16:9',
  },
  {
    label: '4:3',
    key: '4:3',
    icon: () => h(NIcon, null, { default: () => h(Tablet32Regular) }),
    disabled: aspectRatio.value === '4:3',
  },
  {
    label: '9:16',
    key: '9:16',
    icon: () => h(NIcon, null, { default: () => h(Phone16Regular) }),
    disabled: aspectRatio.value === '9:16',
  },
  {
    label: '3:4',
    key: '3:4',
    icon: () => h(NIcon, null, { default: () => h(Phone24Regular) }),
    disabled: aspectRatio.value === '3:4',
  },
  {
    label: '1:1',
    key: '1:1',
    icon: () => h(NIcon, null, { default: () => h(Square16Regular) }),
    disabled: aspectRatio.value === '1:1',
  },
]);

// 长宽比对应 width/height 的 map
const aspectRatioMap: Record<string, { w: number; h: number }> = {
  // 以1080P为基准，保证长宽为偶数
  '21:9': { w: 1792, h: 768 }, // 21:9 等比放大，取接近1080高度的偶数
  '16:9': { w: 1920, h: 1080 }, // 标准1080P
  '4:3': { w: 1440, h: 1080 },  // 4:3 等比放大，高度1080，宽度取偶数
  '9:16': { w: 608, h: 1080 },  // 9:16 等比放大，高度1080，宽度取偶数
  '3:4': { w: 810, h: 1080 },   // 3:4 等比放大，高度1080，宽度取偶数
  '1:1': { w: 1080, h: 1080 },  // 1:1 等比放大，高度1080，宽度取偶数
};

watch([width, height], ([width, height]) => {
  // 监听宽度和高度变化，更新长宽比
  // 通过长宽比进行计算，找到最接近的比例
  const ratios = Object.keys(aspectRatioMap);
  const values = ratios.map(item => item.split(':').map(v => +v)).map(([w, h]) => w/h);
  const target = width / height;
  const closestIndex = ratios.reduce((acc, _, i) => {
    const diff = Math.abs(target - values[i]);
    return diff < Math.abs(target - values[acc]) ? i : acc;
  }, 0);
  const closestRatio = ratios[closestIndex];
  aspectRatio.value = closestRatio;
}, { immediate: true });

// 处理长宽比选择
function handleSelectAspectRatio(value: string) {
  aspectRatio.value = value;
  const { w, h } = aspectRatioMap[value];
  // 更新宽度和高度
  width.value = w;
  height.value = h;
}
</script>

<template>
    <NDropdown trigger="click" placement="top-end" size="small" :options="AspectRatioOptions" @select="handleSelectAspectRatio">
        <NButton text :focusable="false" size="tiny">
            <template #icon>
                <NIcon>
                <PhoneDesktop28Regular />
                </NIcon>
            </template>
            <span v-if="props.displayAspect">{{ aspectRatio }}</span>
        </NButton>
    </NDropdown>
</template>

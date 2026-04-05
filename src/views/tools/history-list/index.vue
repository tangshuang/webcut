<script setup lang="ts">
import { NPopover, NButton, NIcon, NElement } from 'naive-ui';
import { History16Regular } from '@vicons/fluent';
import { CaretRight } from '@vicons/carbon';
import { useT } from '../../../i18n/hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { computed, ref } from 'vue';

const t = useT();
const { historyList, refreshHistoryList, recoverToHistory } = useWebCutHistory();
const showPopover = ref(false);
const sortedHistoryList = computed(() => {
  return [...historyList.value].sort((a, b) => b.timestamp - a.timestamp);
});

function formatRelativeTime(timestamp: number) {
  const diff = Math.max(0, Date.now() - timestamp);
  const sec = Math.floor(diff / 1000);

  if (sec < 60) {
    return t('{count}秒前', { count: Math.max(1, sec) });
  }

  if (sec < 3600) {
    return t('{count}分钟前', { count: Math.floor(sec / 60) });
  }

  if (sec <= 7200) {
    return t('1小时前');
  }

  return '';
}

async function handleOpen() {
  showPopover.value = true;
  await refreshHistoryList();
}

async function handleSelect(historyId: string) {
  await recoverToHistory(historyId);
  showPopover.value = false;
}
</script>

<template>
  <n-popover trigger="click" class="webcut-tooltip webcut-history-popover" v-model:show="showPopover" placement="top-start" flip style="padding: 0" content-style="padding: 4px 0">
    <template #trigger>
      <n-button quaternary size="small" :focusable="false" @click="handleOpen" class="webcut-tool-button">
        <template #icon>
          <n-icon :component="History16Regular" size="16px"></n-icon>
        </template>
      </n-button>
    </template>
    <n-element content class="webcut-history-list">
      <button
        v-for="item in sortedHistoryList"
        :key="item.id"
        class="webcut-history-item"
        :class="{ current: item.current }"
        @click="handleSelect(item.id)"
      >
        <n-icon class="webcut-history-arrow" :component="CaretRight" size="12px"></n-icon>
        <span class="webcut-history-title">{{ t(item.title || '编辑变更') }}</span>
        <span v-if="formatRelativeTime(item.timestamp)" class="webcut-history-time">{{ formatRelativeTime(item.timestamp) }}</span>
      </button>
      <small v-if="!historyList.length">{{ t('暂无历史记录') }}</small>
    </n-element>
  </n-popover>
</template>

<style scoped>
.webcut-history-list {
  width: 240px;
  max-height: 260px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 12px;
}
.webcut-history-item {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-color);
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  cursor: pointer;
  text-align: left;
  border-radius: 3px;
  line-height: 1.2;
}
.webcut-history-item:hover {
  background: var(--table-color-hover);
}
.webcut-history-arrow {
  opacity: 0;
  flex-shrink: 0;
}
.webcut-history-item.current .webcut-history-arrow {
  opacity: 1;
}
.webcut-history-title {
  flex: 1;
}
.webcut-history-time {
  opacity: .55;
  font-size: 11px;
}
</style>

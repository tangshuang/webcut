<script setup lang="ts">
import { computed } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Translate } from '@vicons/carbon';
import { useWebCutLanguage, useT } from '../../hooks';

const { language } = useWebCutLanguage();
const t = useT();

// 语言选项
const languageOptions = computed(() => [
  {
    label: '中文',
    key: 'zh-CN',
    disabled: language.value === 'zh-CN' || language.value === 'zh',
  },
  {
    label: 'English',
    key: 'en-US',
    disabled: language.value === 'en-US' || language.value === 'en',
  },
]);

// 当前语言显示文本
const currentLanguageLabel = computed(() => {
  const lang = language.value || 'zh-CN';
  if (lang === 'zh-CN' || lang === 'zh' || lang.startsWith('zh')) {
    return '中文';
  }
  if (lang === 'en-US' || lang === 'en' || lang.startsWith('en')) {
    return 'English';
  }
  return '中文';
});

// 处理语言切换
function handleSelectLanguage(key: string) {
  language.value = key;
}
</script>

<template>
  <n-dropdown trigger="click" placement="bottom-end" size="small" :options="languageOptions" @select="handleSelectLanguage" class="webcut-lang-switch-dropdown">
    <n-button text :focusable="false" size="tiny" class="webcut-lang-switch">
      <template #icon>
        <n-icon>
          <Translate />
        </n-icon>
      </template>
      <span>{{ currentLanguageLabel }}</span>
    </n-button>
  </n-dropdown>
</template>

<style scoped>
.webcut-lang-switch {
  font-size: 0.7em;
}
:global(.webcut-lang-switch-dropdown) {
  font-size: 12px;
}
</style>


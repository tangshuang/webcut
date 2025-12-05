<script setup lang="ts">
import { computed } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Translate } from '@vicons/carbon';
import { useWebCutLocale } from '../../hooks/i18n';

const { locale } = useWebCutLocale();

// 语言选项
const languageOptions = computed(() => [
  {
    label: '中文',
    key: 'zh-CN',
    disabled: locale.value === 'zh-CN' || locale.value === 'zh',
  },
  {
    label: 'English',
    key: 'en-US',
    disabled: locale.value === 'en-US' || locale.value === 'en',
  },
]);

// 当前语言显示文本
const currentLanguageLabel = computed(() => {
  const lang = locale.value || 'zh-CN';
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
  locale.value = key;
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


<script setup lang="ts">
import { computed } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Translate } from '@vicons/carbon';
import { useWebCutLocale } from '../../i18n/hooks';
import { languageLabelMap, supportedLanguages } from '../../i18n/core';

const { locale } = useWebCutLocale();

// 语言选项
const languageOptions = computed(() => supportedLanguages.map((key) => {
  const lang = key.split('-')[0];
  const label = languageLabelMap[key] || languageLabelMap[lang] || key;
  return {
    label,
    key,
    disabled: locale.value === key || locale.value === lang,
  };
}));

// 当前语言显示文本
const currentLanguageLabel = computed(() => {
  const lang = locale.value || 'zh-CN';
  const option = languageOptions.value.find((item) => item.key === lang);
  return option?.label;
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
  font-size: var(--webcut-font-size-tiny);
}
:global(.webcut-lang-switch-dropdown) {
  font-size: var(--webcut-font-size-tiny);
}
</style>


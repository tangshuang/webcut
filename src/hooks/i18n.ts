// 简化版国际化支持
// 移除了对 vue-i18n 的依赖，只保留基本功能
// 中文作为默认语言，直接使用 key 作为显示内容，无需翻译
// 只保留英文翻译包，当语言不支持时自动使用 key（中文原文）

import { computed, inject } from 'vue';
import enUS from '../locales/en-US';

// 语言包映射（只保留英文）
const locales: Record<string, Record<string, string>> = {
  'en-US': enUS,
  'en': enUS,
};

/**
 * 获取语言包
 */
function getLocale(lang?: string): Record<string, string> | null {
  const language = lang || navigator.language || 'zh-CN';

  // 如果是中文，返回 null，表示使用 key 作为显示内容
  if (language === 'zh-CN' || language === 'zh' || language.startsWith('zh')) {
    return null;
  }

  // 尝试精确匹配
  if (locales[language]) {
    return locales[language];
  }

  // 尝试匹配语言前缀（如 en-US -> en）
  const langPrefix = language.split('-')[0];
  if (locales[langPrefix]) {
    return locales[langPrefix];
  }

  // 不支持的语言，返回 null，使用 key 作为显示内容
  return null;
}

/**
 * 简化版翻译函数
 * @param key 翻译键
 * @param args 插值参数
 * @returns 翻译后的文本
 */
export function useT() {
  // 尝试从useWebCutLanguage中获取语言，如果获取不到则使用默认值
  const injectedLanguage = inject<ReturnType<typeof computed<string>> | null>('WEBCUT_LANGUAGE', null);
  const languageRef = injectedLanguage || computed(() => navigator.language || 'zh-CN');

  return (key: string, args?: any): string => {
    if (!key) {
      return '';
    }

    // 每次调用时获取最新的语言设置（响应式）
    const currentLanguage = languageRef.value;
    const locale = getLocale(currentLanguage);

    // 如果没有语言包（中文或不支持的语言），直接返回 key（中文原文）
    if (!locale) {
      let result = key;
      // 简单的插值替换
      if (args && typeof args === 'object') {
        Object.keys(args).forEach(argKey => {
          result = result.replace(new RegExp(`\\{${argKey}\\}`, 'g'), String(args[argKey]));
        });
      }
      return result;
    }

    // 获取翻译文本，如果没有找到则返回原始key（中文原文）
    let result = locale[key] || key;

    // 简单的插值替换
    if (args && typeof args === 'object') {
      Object.keys(args).forEach(argKey => {
        result = result.replace(new RegExp(`\\{${argKey}\\}`, 'g'), String(args[argKey]));
      });
    }

    return result;
  };
}


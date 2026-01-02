// 简化版国际化支持
// 移除了对 vue-i18n 的依赖，只保留基本功能
// 中文作为默认语言，直接使用 key 作为显示内容，无需翻译
// 只保留英文翻译包，当语言不支持时自动使用 key（中文原文）

import { computed, inject, ref, provide, type WritableComputedRef, type ModelRef } from 'vue';
import { useWebCutContext } from '../../hooks';
import { getLangPkg, supportedLanguages } from '../core';

export function useWebCutLocale(language?: ModelRef<string | null | undefined>) {
    const { id } = useWebCutContext();
    const parentLanguage = inject<ModelRef<string | null | undefined> | WritableComputedRef<string | null | undefined> | null>('WEBCUT_LANGUAGE', null);
    const cachedLanguage = computed(() => localStorage.getItem('WEBCUT_LANGUAGE:' + id.value));
    const languageState = ref<string>();
    const currentLanguage = computed({
        get: () => {
            // 受控模式
            if (language?.value !== null && language?.value !== undefined) {
                return language.value;
            }

            // 覆盖模式
            if (parentLanguage?.value !== null && parentLanguage?.value !== undefined) {
                return parentLanguage.value;
            }

            // 非受控模式
            if (languageState.value) {
                return languageState.value;
            }
            if (cachedLanguage.value) {
                return cachedLanguage.value;
            }

            if (supportedLanguages.includes(navigator.language)) {
                return navigator.language;
            }

            const findBestMatch = (userLanguages: string[]): string | null => {
                for (const userLang of userLanguages) {
                    const normalizedLang = userLang.toLowerCase();
                    
                    for (const supportedLang of supportedLanguages) {
                        const normalizedSupported = supportedLang.toLowerCase();
                        
                        if (normalizedLang === normalizedSupported) {
                            return supportedLang;
                        }
                        
                        const userLangPrefix = normalizedLang.split('-')[0];
                        const supportedLangPrefix = normalizedSupported.split('-')[0];
                        
                        if (userLangPrefix === supportedLangPrefix) {
                            return supportedLang;
                        }
                    }
                }
                return null;
            };

            const languages = [navigator.language, ...(navigator.languages || [])];
            const bestMatch = findBestMatch(languages);

            if (bestMatch) {
                return bestMatch;
            }

            return 'zh-CN';
        },
        set: (v) => {
            // 受控模式
            if (language?.value !== null && language?.value !== undefined) {
                language.value = v;
                return;
            }

            // 覆盖模式
            if (parentLanguage?.value !== null && parentLanguage?.value !== undefined) {
                parentLanguage.value = v;
                return;
            }

            // 非受控模式
            localStorage.setItem('WEBCUT_LANGUAGE:' + id.value, v);
            languageState.value = v;
        },
    });

    provide('WEBCUT_LANGUAGE', currentLanguage);

    return {
        locale: currentLanguage,
        provide: () => provide('WEBCUT_LANGUAGE', currentLanguage),
    };
}

/**
 * 简化版翻译函数
 * @param key 翻译键
 * @param args 插值参数
 * @returns 翻译后的文本
 */
export function useT() {
    const { locale } = useWebCutLocale();
    return (key: string, args?: any): string => {
        if (!key) {
            return '';
        }

        const lngPkg = getLangPkg(locale.value);

        const parse = (result: string) => {
            // 简单的插值替换
            if (args && typeof args === 'object') {
                Object.keys(args).forEach(argKey => {
                    result = result.replace(new RegExp(`\\{${argKey}\\}`, 'g'), String(args[argKey]));
                });
            }
            return result;
        };

        // 获取翻译文本，如果没有找到则返回原始key（中文原文）
        let result = typeof lngPkg?.[key] === 'string' ? lngPkg[key] : key;
        result = parse(result);
        return result;
    };
}


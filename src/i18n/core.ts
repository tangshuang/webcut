import enUS from './locales/en-US';
import frFR from './locales/fr-FR';
import jaJP from './locales/ja-JP';
import deDE from './locales/de-DE';
import esES from './locales/es-ES';
import zhHK from './locales/zh-HK';
import zhTW from './locales/zh-TW';

// 语言包映射
const langPkgs: Record<string, Record<string, string>> = {
    'en-US': enUS,
    'en': enUS,
    'fr-FR': frFR,
    'fr': frFR,
    'ja-JP': jaJP,
    'ja': jaJP,
    'de-DE': deDE,
    'de': deDE,
    'es-ES': esES,
    'es': esES,
    'zh-HK': zhHK,
    'zh-TW': zhTW,
};

const langLabelMap: Record<string, string> = {
    'zh-CN': '中文(简体)',
    'en-US': 'English',
    'fr-FR': 'Français',
    'ja-JP': '日本語',
    'de-DE': 'Deutsch',
    'es-ES': 'Español',
    'zh-HK': '中文(香港)',
    'zh-TW': '中文(台灣)',
};

/**
 * 追加语言包，注意，如果语言包已存在，会覆盖原有内容，建议此时使用合并函数 mergeLangPkg
 * @param lang 语言代码，如 'en-US'
 * @param pkg 语言包，键值对形式，如 { 'key': 'value' }
 */
export function appendLangPkg(lang: string, pkg: Record<string, string>) {
    langPkgs[lang] = pkg;
}

/**
 * 合并语言包，注意，如果语言包已存在，会合并原有内容
 * @param lang 语言代码，如 'en-US'
 * @param pkg 语言包，键值对形式，如 { 'key': 'value' }
 */
export function mergeLangPkg(lang: string, pkg: Record<string, string>) {
    langPkgs[lang] = { ...(langPkgs[lang] || {}), ...pkg };
}

/**
 * 映射语言包，将一个语言包映射到另一个语言包，注意，如果目标语言包不存在，操作将无效
 * @param lang 语言代码，如 'en'
 * @param toLang 目标语言代码，如 'en-US'
 */
export function mapLangPkg(lang: string, toLang: string) {
    if (langPkgs[toLang]) {
        langPkgs[lang] = langPkgs[toLang];
    }
}

/**
 * 获取语言包
 * @param lang 语言代码，如 'en-US'，如果未指定，会根据浏览器语言自动选择
 * @returns 语言包，键值对形式，如 { 'key': 'value' }，如果语言包不存在，返回 null
 */
export function getLangPkg(lang?: string): Record<string, string> | null {
    const language = lang || navigator.language || 'zh-CN';

    // 尝试精确匹配
    if (langPkgs[language]) {
        return langPkgs[language];
    }

    // 尝试匹配语言前缀（如 en-US -> en）
    const langPrefix = language.split('-')[0];
    if (langPkgs[langPrefix]) {
        return langPkgs[langPrefix];
    }

    // 不支持的语言，返回 null，使用 key 作为显示内容
    return null;
}

export function getLangLabelsMap() {
    return langLabelMap;
}

/**
 * 获取所有语言包
 * @returns 所有语言包，键值对形式，如 { 'en-US': { 'key': 'value' }, 'en': { 'key': 'value' } }
 */
export function getLangPkgsMap() {
    return langPkgs;
}

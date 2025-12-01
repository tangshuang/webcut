// 简化版国际化支持
// 移除了对 vue-i18n 的依赖，只保留基本功能

/**
 * 简化版翻译函数
 * @param key 翻译键
 * @param args 插值参数
 * @returns 翻译后的文本
 */
export function useT() {
  return (key: string, args?: any): string => {
    if (!key) {
      return '';
    }

    // 简单的插值替换
    let result = key;
    if (args && typeof args === 'object') {
      Object.keys(args).forEach(argKey => {
        result = result.replace(new RegExp(`\\{${argKey}\\}`, 'g'), args[argKey]);
      });
    }

    return result;
  };
}
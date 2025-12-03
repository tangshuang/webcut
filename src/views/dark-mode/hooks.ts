import { useWebCutContext } from '../../hooks';
import { onMounted, computed, watch, type Ref, nextTick } from 'vue';

/**
 * 与外部的darkMode进行绑定，当外部的darkMode改变时，更新内部的darkMode，内部的darkMode改变时，更新外部的darkMode
 * 在第一次加载时，会使用外部的darkMode作为初始值
 * @param darkMode
 */
export function useWebCutBindOutsideDarkMode(darkMode: Ref<boolean>) {
  const isDarkMode = useWebCutDarkMode();
  let isInitial = false;
  watch(darkMode, (newValue) => {
    if (typeof newValue === 'boolean' && newValue !== isDarkMode.value) {
      isDarkMode.value = newValue;
    }
    if (!isInitial) {
      nextTick(() => {
        isInitial = true;
      });
    }
  }, { immediate: true });
  watch(isDarkMode, (newValue) => {
    if (!isInitial) {
      return;
    }
    darkMode.value = newValue;
  });
}

export function useWebCutPerfersColorScheme() {
  const { id, perfersColorScheme } = useWebCutContext();

  // 初始化，第一次进来时，从localStorage中获取用户的偏好颜色方案
  onMounted(() => {
      const perfersColorSchemeCache = localStorage.getItem('prefers-color-scheme:' + id.value);
      if (perfersColorSchemeCache && perfersColorSchemeCache !== perfersColorScheme.value) {
          perfersColorScheme.value = perfersColorSchemeCache as 'light' | 'dark';
      }
  });

  // 当用户改变偏好颜色方案时，更新localStorage
  watch(perfersColorScheme, (newValue) => {
    localStorage.setItem('prefers-color-scheme:' + id.value, newValue);
  });

  // // 当浏览器改变偏好颜色方案时，更新本地
  // const media = window.matchMedia(' (prefers-color-scheme: dark)');
  // const onChange = () => {
  //   const next = media.matches ? 'dark' : 'light';
  //   if (next !== perfersColorScheme.value) {
  //     perfersColorScheme.value = next;
  //   }
  // };
  // onMounted(() => {
  //   media.addEventListener('change', onChange);
  // });
  // onUnmounted(() => {
  //   media.removeEventListener('change', onChange);
  // });

  return perfersColorScheme;
}

export function useWebCutDarkMode() {
  const perfersColorScheme = useWebCutPerfersColorScheme();
  const isDarkMode = computed({
    get: () => perfersColorScheme.value === 'dark',
    set: (v: boolean) => {
      perfersColorScheme.value = v ? 'dark' : 'light';
    }
  });
  return isDarkMode;
}

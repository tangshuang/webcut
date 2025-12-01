import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

const media = window.matchMedia(' (prefers-color-scheme: dark)');
const getPerferColorScheme = (isDark: boolean) => isDark ? 'dark' : 'light';
const cache = localStorage.getItem('prefers-color-scheme');

const isDarkMode = ref(cache ? cache === 'dark' : media.matches);

export function usePerferColorScheme() {
  return computed(() => getPerferColorScheme(isDarkMode.value));
}

export function useDarkMode() {
  const onChange = () => {
    const next = media.matches;
    isDarkMode.value = next;
  };

  onMounted(() => {
    media.addEventListener('change', onChange);
  });

  onUnmounted(() => {
    media.removeEventListener('change', onChange);
  });

  const perferColorScheme = usePerferColorScheme();
  watch(perferColorScheme, (value) => {
    document.querySelector('html')?.setAttribute('prefers-color-scheme', value);
    const scheme = getPerferColorScheme(media.matches);
    if (scheme === value) {
      localStorage.removeItem('prefers-color-scheme');
    }
    else {
      localStorage.setItem('prefers-color-scheme', value);
    }
  }, { immediate: true });

  return isDarkMode;
}

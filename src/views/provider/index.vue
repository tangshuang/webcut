<script setup lang="ts">
import { WebCutContext } from '../../types';
import { useWebCutContext } from '../../hooks';
import { useDarkMode } from '../../views/dark-mode/hooks';
import {
    NConfigProvider,
    darkTheme,
    NMessageProvider,
    NLoadingBarProvider,
    NModalProvider,
    NDialogProvider,
    NElement,
    NNotificationProvider,
    zhCN,
    dateZhCN,
    zhTW,
    dateZhTW,
    GlobalThemeOverrides,
} from 'naive-ui';
import { computed } from 'vue';

const props = defineProps<{ data?: Partial<WebCutContext> }>();
if (props.data) {
    const { provide } = useWebCutContext(props.data);
    provide();
}

const BASE_COLOR_DARK = '#1a1a1a';
const THEME_COLOR = '#2196F3';
const THEME_COLOR_HOVER = '#1976D2';
const THEME_COLOR_PRESSED = '#1565C0';
const THEME_COLOR_SUPPLEMENTARY = '#BBDEFB';
const BADGE_COLOR_DARK = '#000000';
const TEXT_COLOR = '#000000';
const TEXT_COLOR_DARK = '#FFFFFF';

const isDarkMode = useDarkMode();
const darkOverrides: GlobalThemeOverrides = {
    common: {
        primaryColor: THEME_COLOR,
        primaryColorHover: THEME_COLOR_HOVER,
        primaryColorPressed: THEME_COLOR_PRESSED,
        primaryColorSuppl: THEME_COLOR_SUPPLEMENTARY,
        baseColor: BASE_COLOR_DARK,
    },
    Button: {
        textColor: TEXT_COLOR_DARK,
        textColorHover: TEXT_COLOR_DARK,
    },
    Switch: {
        railColorActive: THEME_COLOR,
    },
    Message: {
        iconColorSuccess: THEME_COLOR,
    },
    Select: {
        peers: {
            InternalSelection: {
                textColor: TEXT_COLOR_DARK,
                // @ts-ignore
                textColorHover: TEXT_COLOR_DARK,
            },
        },
    },
    Badge: {
        color: BADGE_COLOR_DARK,
    },
};
const lightOverrides: GlobalThemeOverrides = {
    common: {
        primaryColor: THEME_COLOR,
        primaryColorHover: THEME_COLOR_HOVER,
        primaryColorPressed: THEME_COLOR_PRESSED,
        primaryColorSuppl: THEME_COLOR_SUPPLEMENTARY,
        baseColor: import.meta.env.BASE_COLOR,
    },
    Button: {
        textColor: TEXT_COLOR,
        textColorHover: TEXT_COLOR,
    },
    Switch: {
        railColorActive: THEME_COLOR,
    },
    Message: {
        iconColorSuccess: THEME_COLOR,
    },
    Select: {
        peers: {
            InternalSelection: {
                textColor: TEXT_COLOR,
                // @ts-ignore
                textColorHover: TEXT_COLOR,
            },
        },
    },
    Badge: {
        color: BADGE_COLOR_DARK,
    },
};
const theme = computed(() => isDarkMode.value ? darkTheme : undefined);
const overrides = computed(() => isDarkMode.value ? darkOverrides : lightOverrides);

const lang = navigator.language;
const lngPkg = computed(() => {
    if (lang === 'zh-CN') {
        return zhCN;
    }
    if (lang === 'zh-HK') {
        return zhTW;
    }
});
const dateLngPkg = computed(() => {
    if (lang === 'zh-CN') {
        return dateZhCN;
    }
    if (lang === 'zh-HK') {
        return dateZhTW;
    }
});
</script>

<template>
    <div class="webcut-root" :style="{
        '--background-color': isDarkMode ? BASE_COLOR_DARK : 'transparent',
    }">
        <n-config-provider :theme="theme" :theme-overrides="overrides" :locale="lngPkg" :date-locale="dateLngPkg">
            <n-loading-bar-provider>
                <n-modal-provider>
                    <n-dialog-provider>
                        <n-message-provider>
                            <n-element>
                                <n-notification-provider placement="bottom-right">
                                    <div class="webcut-container" :style="{
                                        '--webcut-grey-color': isDarkMode ? '#444' : '#ccc',
                                        '--webcut-grey-deep-color': isDarkMode ? '#222' : '#ddd',
                                        '--webcut-rail-bg-color': isDarkMode ? '#1f1f1f' : '#f5f5f5',
                                        '--webcut-line-color': isDarkMode ? '#000' : '#eee',
                                        '--webcut-thumb-color': isDarkMode ? '#444' : '#eee',
                                        '--webcut-manager-top-bar-color': isDarkMode ? '#222' : '#f0f0f0',
                                        '--small-form-font-size': '10px',
                                        '--small-form-font-size-tiny': '8px',
                                    }">
                                        <slot></slot>
                                    </div>
                                </n-notification-provider>
                            </n-element>
                        </n-message-provider>
                    </n-dialog-provider>
                </n-modal-provider>
            </n-loading-bar-provider>
        </n-config-provider>
    </div>
</template>

<style scoped>
.webcut-root {
    flex: 1;
    height: 100%;
    width: 100%;
    background-color: var(--background-color);
}

.webcut-container,
.webcut-root :deep(.n-config-provider),
.webcut-root :deep(.n-element) {
    display: contents;
}

.webcut-container {
    color: var(--text-color-base);
}
.webcut-root :deep(.sprite-rect .ctrl-key-rotate) {
    cursor: url(../../img/rotate.svg) 20 20, crosshair !important;
}

/** override naiveui */

.webcut-root :deep(.n-form) {
  width: 100%;
}
.webcut-root :deep(.n-form .audio-player-wrapper) {
  justify-content: flex-start !important;
}
.webcut-root :deep(.n-form-item .n-input-number) {
  width: 100%;
}
.webcut-root :deep(.n-form-item .n-slider) {
  padding: 0 2px;
}
.webcut-root :deep(.n-form-item .n-form-item-feedback) {
  font-size: .8em;
  margin-bottom: 16px;
}
.webcut-root :deep(.n-form-item .n-input-group) {
  align-items: center;
}
.webcut-root :deep(.n-form-item .n-slider + .n-input-number) {
  width: 260px;
  margin-left: 16px !important;
}
.webcut-root :deep(.n-form-item.n-form-item--left-labelled .n-form-item-label) {
  word-break: break-all;
  white-space: wrap;
  max-width: 140px;
  align-items: center;
}
.webcut-root :deep(.n-form-item--flex-column .n-form-item-blank) {
  flex-direction: column !important;
  align-items: flex-start;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--flex-start .n-form-item-blank) {
  align-items: flex-start;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--flex-column.n-form-item--flex-start .n-form-item-blank) {
  justify-content: flex-start;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--between-space .n-form-item-blank) {
  justify-content: space-between;
}
.webcut-root :deep(.n-form-item--flex-column.n-form-item--flex-end .n-form-item-blank) {
  align-items: flex-end;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--flex-column.n-form-item--flex-end .n-input-group) {
  justify-content: flex-end;
}
.webcut-root :deep(.n-form-item--flex-end .n-form-item-blank) {
  justify-content: flex-end;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--flex-row .n-form-item-blank) {
  gap: 4px;
}
.webcut-root :deep(.n-form-item--flex-row .n-form-item-blank > .n-input-number) {
  flex: 1;
}
.webcut-root :deep(.n-form-item-message) {
  font-size: .8em;
  opacity: .8;
}
.webcut-root :deep(.n-form-item .n-input__input) {
  min-width: 60px;
  flex-grow: 1;
}
.webcut-root :deep(.n-form-item-row) {
  display: flex;
}
.webcut-root :deep(.n-form-item--inline) {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}
.webcut-root :deep(.n-form-item--inline > :first-child) {
  margin-right: auto;
}
.webcut-root :deep(.n-form-item--inline-between-space) {
  justify-content: space-between;
}
.webcut-root :deep(.n-form-item-actions--top-right) {
  position: absolute;
  right: 0;
  bottom: 100%;
  margin-bottom: 8px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.webcut-root :deep(.n-form > .n-button + .n-button) {
  margin-left: 8px;
}
.webcut-root :deep(.n-form-gap > .n-button + .n-button) {
  margin-left: 0;
}
.webcut-root :deep(.n-form-item + .n-divider) {
    margin-top: 0;
}
.webcut-root :deep(.n-form-item--small-size),
.webcut-root :deep(.n-form-item--small-size .n-form-item-label__text) {
  font-size: var(--small-form-font-size) !important;
  --n-label-font-size: var(--small-form-font-size) !important;
}
.webcut-root :deep(.n-form-item--small-size .n-input-group-label) {
    font-size: var(--small-form-font-size) !important;
}
.webcut-root :deep(.n-form-item--small-size .n-button) {
    font-size: var(--small-form-font-size) !important;
}
.webcut-root :deep(.n-form-item--small-size .n-form-item-feedback) {
  font-size: var(--small-form-font-size-tiny);
}
.webcut-root :deep(.n-color-picker-trigger__value) {
    opacity: 0;
}
.webcut-root :deep(.n-form-item--small-size .n-input__textarea-el) {
    font-size: var(--small-form-font-size);
}
</style>
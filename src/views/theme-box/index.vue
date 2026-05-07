<script setup lang="ts">
import { useWebCutThemeColors, useWebCutDarkMode } from '../../hooks';
import { withColorOpacity } from '../../libs/color';

const { themeColors } = useWebCutThemeColors();
const { isDarkMode } = useWebCutDarkMode();
</script>

<template>
    <div
        class="webcut-theme-box"
        :style="{
            '--webcut-background-color': isDarkMode ? themeColors.backgroundColorDark : themeColors.backgroundColor,
            '--webcut-grey-color': isDarkMode ? themeColors.greyColorDark : themeColors.greyColor,
            '--webcut-grey-deep-color': isDarkMode ? themeColors.greyDeepColorDark : themeColors.greyDeepColor,
            '--webcut-rail-bg-color': isDarkMode ? themeColors.railBgColorDark : themeColors.railBgColor,
            '--webcut-rail-hover-bg-color': isDarkMode ? themeColors.railHoverBgColorDark : themeColors.railHoverBgColor,
            '--webcut-theme-opacity-color': withColorOpacity(themeColors.primaryColor, 0.25),
            '--webcut-line-color': isDarkMode ? themeColors.lineColorDark : themeColors.lineColor,
            '--webcut-thumb-color': isDarkMode ? themeColors.thumbColorDark : themeColors.thumbColor,
            '--webcut-manager-top-bar-color': isDarkMode ? themeColors.managerTopBarColorDark : themeColors.managerTopBarColor,
            '--webcut-close-icon-color': isDarkMode ? themeColors.closeIconColorDark : themeColors.closeIconColor,
            '--webcut-font-size-large': '20px',
            '--webcut-font-size-normal': '14px',
            '--webcut-font-size-small': '12px',
            '--webcut-font-size-tiny': '10px',
        }"
    >
        <slot></slot>
    </div>
</template>

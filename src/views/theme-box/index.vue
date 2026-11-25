<script setup lang="ts">
import { computed } from 'vue';
import { useWebCutThemeColors, useWebCutDarkMode } from '../../hooks';
import { withColorOpacity } from '../../libs/color';

const { themeColors } = useWebCutThemeColors();
const { isDarkMode } = useWebCutDarkMode();

/**
 * 主题作用域：盒子内的明暗一律以 webcut 自身的 isDarkMode 为准，不跟随外层（宿主容器 / 系统偏好）。
 *
 * 背景：宿主经 colors 传入的通常是指向宿主主题变量的引用（如 railBgColor: 'var(--grey-color)'），
 * 浅/深两个变体是同一个变量，实际取值由 DOM 上外层的明暗作用域决定，而非 webcut 的 isDarkMode。
 * 当外层是深色作用域而 webcut 设为浅色时，就会出现「标尺/轨道背景深色、文字却按浅色配色」的割裂
 * （naive-ui 主题与标尺 canvas 跟随 isDarkMode，只有这类变量取色跟随了外层）。
 *
 * - prefers-color-scheme 属性：宿主（如 fgu 站点）约定用该属性划分明暗作用域，变量按最近的带该属性的祖先取值，
 *   盒子上按自身模式重新划定作用域，使宿主主题变量在盒子内跟随 webcut 的模式
 * - color-scheme：标准属性，同步约束 UA 默认配色（滚动条、原生控件）与 prefers-color-scheme 媒体查询的求值，
 *   避免系统深色时浅色 webcut 内出现深色的 UA 渲染
 */
const colorScheme = computed(() => (isDarkMode.value ? 'dark' : 'light'));
</script>

<template>
    <div
        class="webcut-theme-box"
        :prefers-color-scheme="colorScheme"
        :style="{
            colorScheme: colorScheme,
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

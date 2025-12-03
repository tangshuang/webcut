<script setup lang="tsx">
import { NIcon, NSwitch } from 'naive-ui';
import { useWebCutDarkMode } from './hooks';
import { WeatherMoon16Regular, WeatherSunny16Regular } from '@vicons/fluent';
import { watch } from 'vue';

const darkMode = defineModel<boolean>('isDarkMode', { default: false });

const isDarkMode = useWebCutDarkMode();

watch(darkMode, (newValue) => {
    if (typeof newValue === 'boolean' && newValue !== isDarkMode.value) {
        isDarkMode.value = newValue;
    }
}, { immediate: true });
watch(isDarkMode, (newValue) => {
    darkMode.value = newValue;
});
</script>

<template>
    <n-switch v-model:value="isDarkMode" size="small" :style="{
        '--n-rail-color-active': '#222',
    }" style="margin-top: -2px;" class="webcut-theme-switch">
        <template #checked-icon>
            <n-icon :component="WeatherMoon16Regular"></n-icon>
        </template>
        <template #unchecked-icon>
            <n-icon :component="WeatherSunny16Regular"></n-icon>
        </template>
    </n-switch>
</template>

<style>
.webcut-root .webcut-theme-switch.n-switch.n-switch--active .n-switch__rail {
    --n-rail-color-active: #444 !important;
}
</style>
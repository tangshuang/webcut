<script setup lang="ts">
import { computed } from 'vue';
import { useWebCutDarkMode } from '../../hooks';
import { useWebCutToast } from '../../hooks/toast';
import { CheckmarkOutline, Information, Warning, Reset } from '@vicons/carbon';
import { NIcon, NSpin } from 'naive-ui';

const { state } = useWebCutToast();

const { isDarkMode } = useWebCutDarkMode();

const iconMap = {
    success: CheckmarkOutline,
    error: Warning,
    info: Information,
    loading: Reset,
};

const icon = computed(() => iconMap[state.type || 'info']);
</script>

<template>
    <Teleport to="body">
        <Transition name="webcut-toast-fade">
            <div
                v-if="state.visible"
                class="webcut-toast"
                :class="[`webcut-toast--${state.type || 'info'}`, { 'webcut-toast--dark': isDarkMode }]"
            >
                <n-icon :component="icon" class="webcut-toast__icon" v-if="state.type !== 'loading'"/>
                <n-spin class="webcut-toast__icon" size="large" v-if="state.type === 'loading'" />
                <span class="webcut-toast__message">{{ state.message }}</span>
            </div>
        </Transition>
    </Teleport>
</template>

<style>
.webcut-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    min-width: 120px;
    max-width: 400px;
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #333;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
}

.webcut-toast--dark {
    background-color: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
}

.webcut-toast__icon {
    font-size: 24px;
    font-weight: bold;
    flex-shrink: 0;
}

.webcut-toast--success .webcut-toast__icon {
    color: #22c55e;
}

.webcut-toast--error .webcut-toast__icon {
    color: #ef4444;
}

.webcut-toast--info .webcut-toast__icon {
    color: #3b82f6;
}

.webcut-toast--loading .webcut-toast__icon {
    color: #a855f7;
}

.webcut-toast--dark.webcut-toast--success .webcut-toast__icon {
    color: #4ade80;
}

.webcut-toast--dark.webcut-toast--error .webcut-toast__icon {
    color: #f87171;
}

.webcut-toast--dark.webcut-toast--info .webcut-toast__icon {
    color: #60a5fa;
}

.webcut-toast--dark.webcut-toast--loading .webcut-toast__icon {
    color: #c084fc;
}

.webcut-toast__message {
    word-break: break-word;
    line-height: 1.4;
    max-width: 40vw;
    text-align: left;
}

/* Transition animations */
.webcut-toast-fade-enter-active,
.webcut-toast-fade-leave-active {
    transition: all 0.3s ease;
}

.webcut-toast-fade-enter-from,
.webcut-toast-fade-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
}

.webcut-toast-fade-enter-to,
.webcut-toast-fade-leave-from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
}
</style>

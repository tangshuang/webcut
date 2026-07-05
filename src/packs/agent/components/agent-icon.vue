<script setup lang="ts">
// agent dock 触发按钮图标（sparkle）。仅渲染 svg，按钮外壳由 WebCutEditor 统一渲染。
</script>

<template>
    <svg
        class="webcut-agent-icon"
        viewBox="0 0 24 24"
        width="1.3em"
        height="1.3em"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
        <path d="M19 14l.8 2L22 16.8 20 17.6 19.2 19.6 18.4 17.6 16.4 16.8 18.4 16 19 14z" />
    </svg>
</template>

<style scoped>
.webcut-agent-icon {
    display: block;
}
</style>

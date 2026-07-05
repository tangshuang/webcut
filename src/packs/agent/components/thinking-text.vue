<script setup lang="ts">
defineProps<{ text?: string }>();
</script>

<template>
    <span class="webcut-agent-thinking-text">{{ text || '…' }}</span>
</template>

<style scoped>
.webcut-agent-thinking-text {
    background: linear-gradient(
        90deg,
        var(--webcut-text-color, #333) 0%,
        var(--webcut-text-color, #333) 40%,
        var(--webcut-primary-color, #00b4a2) 50%,
        var(--webcut-text-color, #333) 60%,
        var(--webcut-text-color, #333) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: webcut-agent-shimmer 1.6s linear infinite;
}
@keyframes webcut-agent-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}
</style>

<script setup lang="ts">
export interface ClipItem {
    key: string;
    index: number;      // @N 引用序号
    name: string;
    type: string;       // video/audio/image/text
    url?: string;       // 缩略图/预览 URL
}

defineProps<{ items: ClipItem[] }>();
const emit = defineEmits<{ (e: 'delete', key: string): void; (e: 'preview', item: ClipItem): void }>();
</script>

<template>
    <div v-if="items.length" class="webcut-agent-clips-bar">
        <div
            v-for="item in items"
            :key="item.key"
            class="webcut-agent-clip-block"
            :title="item.name"
            @click="emit('preview', item)"
        >
            <div class="webcut-agent-clip-thumb">
                <img v-if="item.url && item.type === 'image'" :src="item.url" :alt="item.name" />
                <video v-else-if="item.url && item.type === 'video'" :src="item.url" muted preload="metadata" />
                <span v-else class="webcut-agent-clip-icon">{{ iconFor(item.type) }}</span>
            </div>
            <span class="webcut-agent-clip-index">@{{ item.index }}</span>
            <button
                type="button"
                class="webcut-agent-clip-delete"
                title="删除"
                @click.stop="emit('delete', item.key)"
            >×</button>
        </div>
    </div>
</template>

<script lang="ts">
function iconFor(type: string): string {
    switch (type) {
        case 'video': return '▶';
        case 'audio': return '♪';
        case 'image': return '🖼';
        case 'text': return 'T';
        default: return '•';
    }
}
export default { name: 'ClipsBar' };
</script>

<style scoped>
.webcut-agent-clips-bar {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 2px 0;
    scrollbar-width: thin;
}
.webcut-agent-clips-bar::-webkit-scrollbar { height: 3px; }
.webcut-agent-clips-bar::-webkit-scrollbar-thumb { background: var(--webcut-grey-color); border-radius: 2px; }

.webcut-agent-clip-block {
    position: relative;
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--webcut-line-color);
    background-color: var(--webcut-grey-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.webcut-agent-clip-block:hover {
    border-color: var(--webcut-dock-primary, #00b4a2);
}
.webcut-agent-clip-thumb {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}
.webcut-agent-clip-thumb img,
.webcut-agent-clip-thumb video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.webcut-agent-clip-icon {
    font-size: 16px;
    opacity: 0.5;
}
.webcut-agent-clip-index {
    position: absolute;
    bottom: 1px;
    left: 2px;
    font-size: 9px;
    font-weight: 700;
    color: var(--webcut-text-color, inherit);
    background: var(--webcut-background-color, rgba(255,255,255,0.8));
    padding: 0 2px;
    border-radius: 2px;
    line-height: 1.2;
}
.webcut-agent-clip-delete {
    position: absolute;
    top: 1px;
    right: 1px;
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--webcut-error-color, rgba(0,0,0,0.5));
    color: #fff;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0;
}
.webcut-agent-clip-block:hover .webcut-agent-clip-delete {
    display: flex;
}
.webcut-agent-clip-delete:hover {
    background: var(--webcut-error-color, #d03050);
}
</style>

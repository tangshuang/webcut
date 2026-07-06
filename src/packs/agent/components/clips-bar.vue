<script setup lang="ts">
import { type Component } from 'vue';
import { NIcon } from 'naive-ui';
import { Play, Music, Image as ImageIcon, TextCreation } from '@vicons/carbon';
import { useT } from '../../../i18n/hooks';
import type { ClipItem } from '../clip-types';
defineOptions({ name: 'ClipsBar' });
const t = useT();
defineProps<{ items: ClipItem[] }>();
const emit = defineEmits<{ (e: 'delete', key: string): void; (e: 'preview', item: ClipItem): void }>();

/** 各素材类型对应的图标组件（来自 @vicons/carbon） */
const CLIP_ICONS: Record<string, Component> = {
    video: Play,
    audio: Music,
    image: ImageIcon,
    text: TextCreation,
};
const FALLBACK_ICON = TextCreation;
function clipIcon(type: string): Component {
    return CLIP_ICONS[type] || FALLBACK_ICON;
}
</script>

<template>
    <div v-if="items.length" class="webcut-agent-clips-bar">
        <div
            v-for="item in items"
            :key="item.key"
            class="webcut-agent-clip-block"
            :class="{ 'is-current': item.currentSelectedSegment }"
            :title="item.name"
            @click="emit('preview', item)"
        >
            <div class="webcut-agent-clip-thumb">
                <img v-if="item.url && item.type === 'image'" :src="item.url" :alt="item.name" />
                <video v-else-if="item.url && item.type === 'video'" :src="item.url" muted preload="metadata" />
                <n-icon v-else class="webcut-agent-clip-icon" :component="clipIcon(item.type)" :size="16" />
            </div>
            <span class="webcut-agent-clip-index">{{ item.index > 0 ? '@' + item.index : '@' + (item.name || '').slice(0, 8) }}</span>
            <button
                type="button"
                class="webcut-agent-clip-delete"
                :title="t('webcut.agent.deleteChat')"
                @click.stop="emit('delete', item.key)"
            >×</button>
        </div>
    </div>
</template>

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
/* 时间轴当前高亮焦点片段对应的附件：主色边框 + 轻微外发光，实时跟随 ctx.current */
.webcut-agent-clip-block.is-current {
    border-color: var(--webcut-dock-primary, #00b4a2);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--webcut-dock-primary, #00b4a2) 35%, transparent);
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

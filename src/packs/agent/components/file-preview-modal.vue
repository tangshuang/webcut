<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps<{ type: 'image' | 'video' | 'audio'; url: string; name?: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const scale = ref(1);

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('close');
}
function onWheel(e: WheelEvent) {
    if (props.type !== 'image') return;
    e.preventDefault();
    scale.value = Math.max(0.2, Math.min(5, scale.value + (e.deltaY > 0 ? -0.1 : 0.1)));
}
onMounted(() => {
    document.addEventListener('keydown', onKeydown);
    document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div class="webcut-agent-preview-overlay" @click="emit('close')">
        <div class="webcut-agent-preview-container" @click.stop>
            <!-- 顶部：文件名 + 关闭（absolute 覆盖在媒体上方，两边与媒体对齐） -->
            <div class="webcut-agent-preview-header">
                <span class="webcut-agent-preview-name">{{ name || '预览' }}</span>
                <button type="button" class="webcut-agent-preview-close" @click="emit('close')">×</button>
            </div>
            <!-- 媒体内容（直接放在容器内，决定容器尺寸） -->
            <img
                v-if="type === 'image'"
                :src="url"
                :alt="name"
                class="webcut-agent-preview-img"
                :style="{ transform: `scale(${scale})` }"
                @wheel="onWheel"
            />
            <video
                v-else-if="type === 'video'"
                :src="url"
                controls
                autoplay
                class="webcut-agent-preview-video"
            />
            <div v-else-if="type === 'audio'" class="webcut-agent-preview-audio-wrap">
                <div class="webcut-agent-preview-audio-icon">♪</div>
                <audio :src="url" controls autoplay class="webcut-agent-preview-audio" />
            </div>
        </div>
    </div>
  </Teleport>
</template>

<style scoped>
.webcut-agent-preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 20000;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
}
.webcut-agent-preview-container {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    overflow: hidden;
}
.webcut-agent-preview-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0));
    color: #fff;
    font-size: 13px;
}
.webcut-agent-preview-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
}
.webcut-agent-preview-close {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;
    line-height: 1;
}
.webcut-agent-preview-close:hover { background: rgba(255, 255, 255, 0.15); }
.webcut-agent-preview-img {
    max-width: 90vw;
    max-height: calc(90vh - 50px);
    object-fit: contain;
    transition: transform 0.05s ease;
    user-select: none;
}
.webcut-agent-preview-video {
    max-width: 90vw;
    max-height: calc(90vh - 50px);
}
.webcut-agent-preview-audio-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 60px;
}
.webcut-agent-preview-audio-icon {
    font-size: 64px;
    color: rgba(255, 255, 255, 0.5);
}
.webcut-agent-preview-audio {
    width: 320px;
}
</style>

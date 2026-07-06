<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';
import { useWebCutLibrary } from '../../../hooks/library';
import { useWebCutHistory } from '../../../hooks/history';
import { useWebCutTransition } from '../../../hooks/transition';
import { readFile as readLocalFile } from '../../../db';
import type { WebCutContext } from '../../../types';
import { createWebCutAgentStore, provideWebCutAgentStore, AGENT_PACK_KEY, AGENT_RUNTIME_KEY } from '../store';
import { createAgentLoop } from '../loop';
import type { WebCutAgentPackInstance } from '../index';
import type { WebCutAgentToolRuntime } from '../tools';
import { useT } from '../../../i18n/hooks';
import { NIcon } from 'naive-ui';
import { Add, ChevronRight } from '@vicons/carbon';
import { History16Regular } from '@vicons/fluent';
import MessagesView from './messages-view.vue';
import InitView from './init.vue';
import ChatsPopover from './chats-popover.vue';

const props = defineProps<{ pack?: any }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const t = useT();

const agentPack = (props.pack || {}) as WebCutAgentPackInstance;
const adapter = agentPack.adapter;
const registry = agentPack.registry;

// 响应式剪辑器上下文（raw reactive 对象，工具按 .field 直接读取）
const rawCtx = inject<WebCutContext>('WEBCUT_CONTEXT') as unknown as WebCutContext;
const webcutCtx = useWebCutContext();
const player = useWebCutPlayer();
const manager = useWebCutManager();
const library = useWebCutLibrary();
const history = useWebCutHistory();
const transition = useWebCutTransition();

// store + loop 缓存到 pack 实例上，开关边栏（卸载/重挂）时复用，会话状态不丢失
interface CachedRuntime { store: any; loop: any; }
const cached = (agentPack as any).__agentRuntime__ as CachedRuntime | undefined;
if (!cached) {
    const runtime: WebCutAgentToolRuntime = {
        ctx: rawCtx,
        // 查询辅助
        getSource: (key) => rawCtx.sources.get(key) || null,
        findSegment: (key) => {
            for (const rail of rawCtx.rails) {
                const seg = (rail.segments || []).find((s: any) => s.sourceKey === key);
                if (seg) return { rail, segment: seg };
            }
            return null;
        },
        findRail: (railId) => rawCtx.rails.find((r: any) => r.id === railId) || null,
        // player
        push: player.push,
        pushSeries: player.pushSeries,
        remove: player.remove,
        updateText: player.updateText,
        applyAnimation: player.applyAnimation,
        syncSourceMeta: player.syncSourceMeta,
        separateAudioFromVideo: player.separateAudioFromVideo,
        repairPitch: async (sourceKey) => {
            const src = rawCtx.sources.get(sourceKey);
            if (src?.type === 'audio') await player.repairAudioPitchByPlaybackRate(sourceKey);
            else await player.repairVideoPitchByPlaybackRate(sourceKey);
        },
        play: player.play,
        pause: player.pause,
        reset: player.reset,
        exportBlob: player.exportBlob,
        // manager
        deleteSegment: manager.deleteSegment,
        splitSegment: manager.splitSegment,
        toggleRailMute: manager.toggleRailMute,
        toggleRailHidden: manager.toggleRailHidden,
        applyMainVideoMagnet: manager.applyMainVideoMagnet,
        // transition
        applyTransition: transition.applyTransition,
        removeTransition: transition.removeTransition,
        // library
        library: {
            list: () => library.projectFiles.value,
            addNewFile: library.addNewFile,
            // 从本地 OPFS 读取文件
            readFile: (fileId: string) => readLocalFile(fileId),
            // 读本地 + 调 adapter.uploadFile 上传到服务端，返回服务端文件对象
            uploadToServer: async (fileId: string) => {
                const file = await readLocalFile(fileId);
                if (!file) return null;
                const upload = (agentPack as any).adapter?.uploadFile;
                if (typeof upload !== 'function') return null;
                return await upload(file);
            },
        },
        // history
        history: {
            push: history.push,
            undo: history.undo,
            redo: history.redo,
            list: () => history.historyList.value,
            recoverToHistory: history.recoverToHistory,
        },
        // 全局
        updateByAspectRatio: webcutCtx.updateByAspectRatio,
        seekCursor: (time) => player.moveTo(time),
        setScale: (scale) => { rawCtx.scale = scale; },
        // 选中
        unselectSegment: (segmentId, railId) => webcutCtx.unselectSegment(segmentId, railId),
        clearSelection: () => {
            for (const s of [...rawCtx.selected]) {
                webcutCtx.unselectSegment(s.segmentId, s.railId);
            }
        },
    };
    const store = createWebCutAgentStore({ adapter, getScopeId: () => (agentPack as any).getScopeId?.() || '' });
    const loop = createAgentLoop({ adapter, registry, runtime, store });
    // 后端驱动模式（adapter.chats 存在）需要异步拉取 chats 列表/历史；内存模式 init 立即 ready
    store.init();
    (agentPack as any).__agentRuntime__ = { store, loop, runtime };
}
const agentRuntime = (agentPack as any).__agentRuntime__;
const store = agentRuntime.store;
const loop = agentRuntime.loop;
const runtime = agentRuntime.runtime;
// 在当前组件实例重新 provide，使本次挂载的子组件能注入到同一 store 与 runtime
provideWebCutAgentStore(store);
provide(AGENT_PACK_KEY, agentPack);
provide(AGENT_RUNTIME_KEY, runtime);

const showHistory = ref(false);
const historyWrapRef = ref<HTMLElement | null>(null);
function onDocMousedown(e: MouseEvent) {
    if (!showHistory.value) return;
    if (historyWrapRef.value && !historyWrapRef.value.contains(e.target as Node)) {
        showHistory.value = false;
    }
}
onMounted(() => document.addEventListener('mousedown', onDocMousedown));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMousedown));
const isEmpty = computed(() => store.messages.value.length === 0 && !store.isRuning.value);

async function handleNewChat() {
    await store.createChat();
    showHistory.value = false;
}
function handleSend(prompt: string, attachments?: any[]) {
    return loop.send(prompt, { attachments });
}
function handleAbort() {
    loop.abort();
}
</script>

<template>
    <div class="webcut-agent-sidebar">
        <div class="webcut-agent-top-bar">
            <span class="webcut-agent-title">{{ t('webcut.agent.title') }}</span>
            <span class="webcut-agent-top-bar-actions">
                <button type="button" class="webcut-agent-icon-btn tooltip-host" :data-tooltip="t('webcut.agent.newChat')" data-tooltip-pos="bottom" @click="handleNewChat">
                    <n-icon :component="Add" size="16px" />
                </button>
                <div class="webcut-agent-history-wrap" ref="historyWrapRef">
                    <button
                        type="button"
                        class="webcut-agent-icon-btn tooltip-host"
                        :class="{ active: showHistory }"
                        :data-tooltip="t('webcut.agent.history')"
                        data-tooltip-pos="bottom"
                        @click="showHistory = !showHistory"
                    >
                        <n-icon :component="History16Regular" size="16px" />
                    </button>
                    <ChatsPopover v-if="showHistory" @close="showHistory = false" />
                </div>
                <button type="button" class="webcut-agent-icon-btn tooltip-host" :data-tooltip="t('webcut.agent.hide')" data-tooltip-pos="bottom" @click="emit('close')">
                    <n-icon :component="ChevronRight" size="16px" />
                </button>
            </span>
        </div>
        <div class="webcut-agent-body">
            <!-- 后端驱动模式下 init 期间显示加载占位 -->
            <div v-if="!store.ready.value" class="webcut-agent-loading">…</div>
            <InitView v-else-if="isEmpty" :hint="t('webcut.agent.emptyHint')" @send="handleSend" />
            <MessagesView v-else @send="handleSend" @abort="handleAbort" />
        </div>
    </div>
</template>

<style scoped>
.webcut-agent-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--webcut-background-color);
    color: var(--webcut-text-color);
    font-size: 13px;
}
.webcut-agent-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 6px 10px;
    /* border-bottom: 1px solid var(--webcut-line-color); */
    flex-shrink: 0;
}
.webcut-agent-title {
    font-weight: 600;
}
.webcut-agent-top-bar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}
.webcut-agent-icon-btn {
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    color: var(--webcut-text-color);
    cursor: pointer;
    border-radius: 4px;
    font-size: 15px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.75;
}
.webcut-agent-icon-btn:hover {
    background-color: var(--webcut-grey-color);
    opacity: 1;
}
.webcut-agent-icon-btn.active {
    background-color: var(--webcut-grey-color);
    opacity: 1;
}
.webcut-agent-history-wrap {
    position: relative;
}
.webcut-agent-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
/* CSS tooltip */
.tooltip-host { position: relative; }
.tooltip-host::after {
    content: attr(data-tooltip);
    position: absolute;
    display: none;
    padding: 3px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-size: 11px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 20000;
    pointer-events: none;
}
.tooltip-host:hover::after { display: block; }
.tooltip-host[data-tooltip-pos="bottom"]::after { top: calc(100% + 4px); right: 0; }
.tooltip-host[data-tooltip-pos="top"]::after { bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); }
</style>

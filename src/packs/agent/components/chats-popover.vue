<script setup lang="ts">
import { useWebCutAgentStore } from '../store';
import { useT } from '../../../i18n/hooks';

const store = useWebCutAgentStore();
const t = useT();
const emit = defineEmits<{ (e: 'close'): void }>();

function switchTo(id: string) {
    store.switchChat(id);
    emit('close');
}
function remove(id: string) {
    store.deleteChat(id);
}
</script>

<template>
    <div class="webcut-agent-chats-popover">
        <div class="webcut-agent-chats-header">
            <span>{{ t('webcut.agent.history') }}</span>
        </div>
        <div class="webcut-agent-chats-list">
            <div v-if="!store.chats.value.length" class="webcut-agent-chats-empty">—</div>
            <div
                v-for="c in store.chats.value"
                :key="c.id"
                class="webcut-agent-chat-item"
                :class="{ active: c.id === store.currentChatId.value }"
                @click="switchTo(c.id)"
            >
                <span class="webcut-agent-chat-title">{{ c.title || t('webcut.agent.newChat') }}</span>
                <button
                    type="button"
                    class="webcut-agent-chat-del"
                    :title="t('webcut.agent.deleteChat')"
                    @click.stop="remove(c.id)"
                >×</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.webcut-agent-chats-popover {
    position: absolute;
    top: 30px;
    right: 0;
    width: 240px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background-color: var(--webcut-background-color, #fff);
    border: 1px solid var(--webcut-line-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 20000;
    overflow: hidden;
}
.webcut-agent-chats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--webcut-line-color);
    font-size: 12px;
    opacity: 0.7;
}
.webcut-agent-chats-list { overflow-y: auto; }
.webcut-agent-chats-empty { padding: 12px; text-align: center; opacity: 0.5; font-size: 12px; }
.webcut-agent-chat-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    cursor: pointer;
    font-size: 12px;
}
.webcut-agent-chat-item:hover { background-color: var(--webcut-grey-color); }
.webcut-agent-chat-item.active { background-color: var(--webcut-grey-color); }
.webcut-agent-chat-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.webcut-agent-chat-del {
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
}
.webcut-agent-chat-del:hover { opacity: 1; }
</style>

<script setup lang="ts">
import { NSplit } from 'naive-ui';
import WebCutProvider from '../provider/index.vue';
import WebCutPlayerScreen from '../player/screen.vue';
import WebCutPlayerButton from '../player/button.vue';
import WebCutManager from '../manager/index.vue';
import { useWebCutContext, useWebCutPlayer, useWebCutThemeColors, useWebCutDarkMode } from '../../hooks';
import ThemeSwitch from '../theme-switch/index.vue';
import LangSwitch from '../lang-switch/index.vue';
import WebCutSelectAspectRatio from '../select-aspect-ratio/index.vue';
import WebCutSelectResolution from '../select-resolution/index.vue';
import WebCutTimeClock from '../time-clock/index.vue';
import WebCutLibrary from '../library/index.vue';
import { computed, ref, watch, shallowRef } from 'vue';
import Panel from '../panel/index.vue';
import ExportButton from '../export-button/index.vue';
import { WebCutColors, WebCutExtensionPack } from '../../types';
import { useWebCutLocale } from '../../i18n/hooks';
import WebCutToast from '../toast/index.vue';
import AdvancedExport from '../../modules/advanced-export/index.vue';
import WebCutTextEditPanel from '../panel/text/contenteditable.vue';

const darkMode = defineModel<boolean | null | undefined>('darkMode', { default: null });
const language = defineModel<string | null | undefined>('language', { default: null });
const props = defineProps<{
    projectId?: string;
    colors?: Partial<WebCutColors>;
    /** 是否禁用顶部右侧栏 */
    disableRightTopBar?: boolean;
    /** 是否默认开启主轨视频磁吸 */
    enableMainVideoMagnet?: boolean;
    packs?: (new () => WebCutExtensionPack)[];
}>();

const { registerExtensionPack, id, modules, activeDockKey } = useWebCutContext();
const { themeColors } = useWebCutThemeColors(() => props.colors);
useWebCutDarkMode(darkMode);
useWebCutLocale(language);

if (props.projectId) {
    id.value = props.projectId;
}
if (props.packs) {
    props.packs.forEach(mod => registerExtensionPack(mod));
}

const { resize } = useWebCutPlayer();

const manager = ref();
function handleResized() {
    manager.value?.resizeHeight();
}

// dock 槽位：扫描已注册 pack 中声明了 dockConfig 的，渲染悬浮按钮组（整组垂直居中）
const dockPacks = computed(() =>
    [...modules.value.values()]
        .filter((m) => m.dockConfig)
        .map((m) => ({ inst: m, cfg: m.dockConfig! }))
);
const activeDock = computed(() =>
    dockPacks.value.find((d) => d.cfg.key === activeDockKey.value) || null
);
const activeDockWidth = computed(() => activeDock.value?.cfg.width ?? 400);
function toggleDock(key: string) {
    activeDockKey.value = activeDockKey.value === key ? null : key;
}
function closeDock() {
    activeDockKey.value = null;
}

// 抽屉过渡：关闭时延迟卸载内容，让滑出动画跑完（开启时立即显示）
const DOCK_TRANSITION_MS = 340;
const displayedDock = shallowRef<{ inst: any; cfg: any } | null>(null);
let dockCloseTimer: any = null;
watch(activeDock, (d) => {
    if (d) {
        // 开启：立即渲染内容，让滑入动画可见
        if (dockCloseTimer) { clearTimeout(dockCloseTimer); dockCloseTimer = null; }
        displayedDock.value = d;
    } else {
        // 关闭：等过渡结束后再卸载内容
        if (dockCloseTimer) clearTimeout(dockCloseTimer);
        dockCloseTimer = setTimeout(() => {
            if (!activeDock.value) displayedDock.value = null;
            dockCloseTimer = null;
        }, DOCK_TRANSITION_MS);
    }
}, { immediate: true });

// dock 展开态持久化到 localStorage（按项目 id 隔离），刷新后恢复上次的展开状态
const dockStorageKey = computed(() => `WEBCUT_DOCK_ACTIVE:${id.value}`);
try {
    const saved = localStorage.getItem(dockStorageKey.value);
    if (saved !== null) {
        if (saved && dockPacks.value.some((d) => d.cfg.key === saved)) {
            activeDockKey.value = saved;
        } else {
            activeDockKey.value = null;
        }
    }
} catch {}
watch(activeDockKey, (v) => {
    try {
        localStorage.setItem(dockStorageKey.value, v || '');
    } catch {}
});
</script>

<template>
    <WebCutProvider :data="{ enableMainVideoMagnet: props.enableMainVideoMagnet ?? true }">
        <slot name="header"></slot>
        <div
            class="webcut-editor-root"
            :class="{ 'webcut-dock-opened': !!activeDock }"
            :style="{ '--webcut-dock-primary': themeColors.primaryColor, '--webcut-dock-primary-hover': themeColors.primaryColorHover }"
        >
            <div class="webcut-editor">
                <n-split direction="vertical" :default-size="0.8" min="400px" :max="0.8" @update:size="handleResized">
                    <template #1>
                        <n-split default-size="300px" min="200px" max="400px" @update:size="resize">
                            <template #1>
                                <div class="webcut-editor-left-side">
                                    <WebCutLibrary></WebCutLibrary>
                                </div>
                            </template>
                            <template #2>
                                <n-split default-size="calc(100% - 375px)" :min="0.6" :max="0.75" @update:size="resize">
                                    <template #1>
                                        <div class="webcut-editor-video-player-container">
                                            <WebCutPlayerScreen class="webcut-editor-video-player">
                                                <WebCutTextEditPanel></WebCutTextEditPanel>
                                            </WebCutPlayerScreen>
                                        </div>
                                        <div class="webcut-editor-video-player-buttons">
                                            <div class="webcut-editor-video-player-buttons-left">
                                                <WebCutTimeClock></WebCutTimeClock>
                                            </div>
                                            <WebCutPlayerButton></WebCutPlayerButton>
                                            <div class="webcut-editor-video-player-buttons-right">
                                                <WebCutSelectResolution display-resolution></WebCutSelectResolution>
                                                <WebCutSelectAspectRatio display-aspect></WebCutSelectAspectRatio>
                                            </div>
                                        </div>
                                    </template>
                                    <template #2>
                                        <div class="webcut-editor-right-side">
                                            <div class="webcut-editor-right-side-top-bar" v-if="!props.disableRightTopBar">
                                                <slot name="rightTopBar">
                                                    <ThemeSwitch></ThemeSwitch>
                                                    <span style="margin: auto;"></span>
                                                    <LangSwitch></LangSwitch>
                                                    <ExportButton></ExportButton>
                                                    <AdvancedExport></AdvancedExport>
                                                </slot>
                                            </div>
                                            <div class="webcut-editor-right-side-main">
                                                <Panel></Panel>
                                            </div>
                                        </div>
                                    </template>
                                    <template #resize-trigger>
                                        <div class="webcut-editor-split-resize-trigger--vertical"></div>
                                    </template>
                                </n-split>
                            </template>
                            <template #resize-trigger>
                                <div class="webcut-editor-split-resize-trigger--vertical"></div>
                            </template>
                        </n-split>
                    </template>
                    <template #2>
                        <div class="webcut-editor-bottom-side">
                            <WebCutManager ref="manager" />
                        </div>
                    </template>
                    <template #resize-trigger>
                        <div class="webcut-editor-split-resize-trigger--horizontal"></div>
                    </template>
                </n-split>
                <!-- dock 悬浮触发按钮组：贴「编辑器」右侧边缘（非屏幕边缘），sidebar 展开时按钮仍可见；
                     竖向 tab 拉手样式统一，pack 仅提供 triggerIcon + triggerText；
                     主色通过内联 CSS 变量注入（theme-box 未暴露 --webcut-primary-color），保证浅/深色模式下都可见 -->
                <div
                    class="webcut-dock-trigger-group"
                    v-if="dockPacks.length"
                >
                    <button
                        v-for="d in dockPacks"
                        :key="d.cfg.key"
                        type="button"
                        class="webcut-dock-trigger-btn"
                        :class="{ active: d.cfg.key === activeDockKey }"
                        :aria-label="d.cfg.triggerText || d.cfg.key"
                        :title="d.cfg.triggerText || d.cfg.key"
                        @click="toggleDock(d.cfg.key)"
                    >
                        <component v-if="d.cfg.triggerIcon" :is="d.cfg.triggerIcon" class="webcut-dock-trigger-icon"></component>
                        <span v-if="d.cfg.triggerText" class="webcut-dock-trigger-text">{{ d.cfg.triggerText }}</span>
                    </button>
                </div>
            </div>
            <!-- dock 抽屉：容器 width 过渡（推动 editor）+ 内层 translateX 滑动，组成抽屉效果 -->
            <aside
                class="webcut-dock-sidebar"
                v-if="dockPacks.length"
                :class="{ open: !!activeDock }"
                :style="{ '--webcut-dock-w': activeDockWidth + 'px' }"
            >
                <div class="webcut-dock-sidebar-inner" :class="{ open: !!activeDock }">
                    <component
                        v-if="displayedDock"
                        :is="displayedDock.cfg.sidebar"
                        :pack="displayedDock.inst"
                        @close="closeDock()"
                    ></component>
                </div>
            </aside>
        </div>
        <slot name="footer"></slot>
        <WebCutToast></WebCutToast>
    </WebCutProvider>
</template>

<style scoped>
.webcut-editor-root {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    overflow: hidden;
}
.webcut-dock-opened .webcut-editor {
    flex: 1;
    min-width: 0;
}
/* dock 触发按钮组：右侧贴边、整组垂直居中、纵向堆叠（vee 风格的竖向 tab 拉手） */
.webcut-dock-trigger-group {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    z-index: 20000;
    pointer-events: auto;
}
.webcut-dock-trigger-btn {
    min-width: 20px;
    padding: 8px 0 10px 4px;
    border: none;
    border-radius: 50% 0 0 50%; /* 左侧半圆、右侧贴边 */
    background-color: var(--webcut-dock-primary, #00b4a2); /* 主色由内联 CSS 变量注入 */
    color: #fff;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0.75; /* 默认状态半透明；激活态提到 1 高亮 */
    transition: padding-right 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
    font-size: 0.75em;
}
.webcut-dock-trigger-btn:hover {
    opacity: 0.92;
    padding-right: 2px;
    background-color: var(--webcut-dock-primary-hover, #01a595);
}
.webcut-dock-trigger-btn.active {
    opacity: 1; /* 激活的 dock 对应按钮高亮：完全不透明 */
}
.webcut-dock-trigger-text {
    writing-mode: vertical-rl;
    text-orientation: sideways; /* 整体旋转 90° 的纵向排版（字符也旋转） */
    letter-spacing: 1px;
    white-space: nowrap;
}
.webcut-dock-trigger-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.3em;
    height: 1.3em;
    fill: currentColor;
    stroke-color: currentColor;
    vertical-align: -0.15em;
}
/* 抽屉容器：width 0 ↔ 目标宽度过渡（推动 editor），overflow:hidden 裁掉滑出的内层 */
.webcut-dock-sidebar {
    height: 100%;
    flex-shrink: 0;
    width: 0;
    border-left: 0 solid var(--webcut-line-color);
    background-color: var(--webcut-background-color);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: width var(--webcut-dock-transition, 0.34s cubic-bezier(0.22, 1, 0.36, 1)),
                border-left-width var(--webcut-dock-transition, 0.34s cubic-bezier(0.22, 1, 0.36, 1));
}
.webcut-dock-sidebar.open {
    width: var(--webcut-dock-w, 420px);
    border-left-width: 1px;
}
/* 抽屉内层：固定宽度 + translateX 滑动，与容器 width 同步过渡形成抽屉效果 */
.webcut-dock-sidebar-inner {
    width: var(--webcut-dock-w, 420px);
    height: 100%;
    display: flex;
    flex-direction: column;
    transform: translateX(100%); /* 关闭：滑到右侧容器外 */
    transition: transform var(--webcut-dock-transition, 0.34s cubic-bezier(0.22, 1, 0.36, 1));
    will-change: transform;
}
.webcut-dock-sidebar-inner.open {
    transform: translateX(0); /* 开启：滑入到位 */
}
</style>

<style scoped lang="less">
.webcut-editor {
    position: relative;
    height: 100%;
    width: 100%;
    flex: 1;
    min-width: 0;
}
.webcut-editor-split-resize-trigger--horizontal {
    width: 100%;
    height: 2px;
    background-color: var(--webcut-line-color);
}
.webcut-editor-split-resize-trigger--vertical {
    height: 100%;
    width: 2px;
    background-color: var(--webcut-line-color);
}
.webcut-editor-video-player-container {
    height: calc(100% - 56px);
    width: calc(100% - 32px);
    margin: 16px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.webcut-editor-video-player {
    height: 100%;
    width: 100%;
}
.webcut-editor-video-player-buttons {
    height: 24px;
    width: calc(100% - 32px);
    margin: 8px 16px;
    margin-top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.webcut-editor-video-player-buttons-right,
.webcut-editor-video-player-buttons-left {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    opacity: .6;
    z-index: 10;
}
.webcut-editor-video-player-buttons-right {
    right: 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.webcut-editor-video-player-buttons-left {
    left: 0;
}
.webcut-editor-right-side {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.webcut-editor-right-side-top-bar {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 4px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-editor-right-side-main {
    flex: 1;
    overflow: auto;
}
.webcut-editor-bottom-side {
    height: 100%;
}
.webcut-editor-left-side {
    height: 100%;
    overflow: hidden;
}
</style>

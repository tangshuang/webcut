<script setup lang="ts">
import { NIcon, NSplit } from 'naive-ui';
import { Video, Music, Image, StringText, Locked, Unlocked, View, ViewOff, VolumeMute, VolumeUp } from '@vicons/carbon';
import WebCutProvider from '../provider/index.vue';
import WebCutPlayerScreen from '../player/screen.vue';
import WebCutPlayerButton from '../player/button.vue';
import WebCutManager from '../manager/index.vue';
import WebCutManagerScaler from '../manager/scaler/index.vue';
import { useWebCutContext, useWebCutPlayer, useWebCutThemeColors, useWebCutDarkMode } from '../../hooks';
import ThemeSwitch from '../theme-switch/index.vue';
import WebCutSelectAspectRatio from '../select-aspect-ratio/index.vue';
import WebCutTimeClock from '../time-clock/index.vue';
import WebCutLibrary from '../library/index.vue';
import VideoSegment from '../manager/segments/video.vue';
import AudioSegment from '../manager/segments/audio.vue';
import ImageSegment from '../manager/segments/image.vue';
import TextSegment from '../manager/segments/text.vue';
import { onMounted, ref } from 'vue';
import { useWebCutManager } from '../../hooks/manager';
import ClearSelected from '../tools/clear-selected/index.vue';
import DeleteCurrent from '../tools/delete-current/index.vue';
import SplitCurrent from '../tools/split-current/index.vue';
import SplitKeepLeft from '../tools/split-keep-left/index.vue';
import SplitKeepRight from '../tools/split-keep-right/index.vue';
// import Undo from '../tools/undo/index.vue';
// import Redo from '../tools/redo/index.vue';
import Panel from '../panel/index.vue';
import ExportButton from '../export-button/index.vue';
import { WebCutColors } from '../../types';

const darkMode = defineModel<boolean | null | undefined>('darkMode', { default: null });
const props = defineProps<{
    projectId?: string;
    colors?: Partial<WebCutColors>;
    /** 是否禁用顶部右侧栏 */
    disableTopRightBar?: boolean;
}>();

useWebCutContext(() => props.projectId ? { id: props.projectId } : undefined);
useWebCutThemeColors(() => props.colors);
useWebCutDarkMode(darkMode);

const { resize } = useWebCutPlayer();
const { resizeManagerMaxHeight, toggleRailHidden, toggleRailMute } = useWebCutManager();

const bottomSide = ref();

function handleResized() {
    const height = bottomSide.value?.getBoundingClientRect().height - 28; // 28是工具栏的高度
    resizeManagerMaxHeight(height);
    resize();
}

onMounted(handleResized);

function handleToggleLocked(rail: any) {
    rail.locked = !rail.locked;
}
</script>

<template>
    <WebCutProvider>
        <slot name="header"></slot>
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
                            <n-split :default-size="0.75" :min="0.6" :max="0.75" @update:size="resize">
                                <template #1>
                                    <div class="webcut-editor-video-player-container">
                                        <WebCutPlayerScreen class="webcut-editor-video-player"></WebCutPlayerScreen>
                                    </div>
                                    <div class="webcut-editor-video-player-buttons">
                                        <div class="webcut-editor-video-player-buttons-left">
                                            <WebCutTimeClock></WebCutTimeClock>
                                        </div>
                                        <WebCutPlayerButton></WebCutPlayerButton>
                                        <div class="webcut-editor-video-player-buttons-right">
                                            <WebCutSelectAspectRatio display-aspect></WebCutSelectAspectRatio>
                                        </div>
                                    </div>
                                </template>
                                <template #2>
                                    <div class="webcut-editor-right-side">
                                        <div class="webcut-editor-right-side-top-bar" v-if="!props.disableTopRightBar">
                                            <ThemeSwitch></ThemeSwitch>
                                            <span style="margin: auto;"></span>
                                            <ExportButton></ExportButton>
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
                    <div class="webcut-editor-bottom-side" ref="bottomSide">
                        <div class="webcut-editor-tools-bar">
                            <div class="webcut-editor-tools-bar-left"></div>
                            <div class="webcut-editor-tools-bar-right">
                                <!-- <Undo></Undo>
                                <Redo></Redo> -->
                                <ClearSelected></ClearSelected>
                                <DeleteCurrent></DeleteCurrent>
                                <SplitCurrent></SplitCurrent>
                                <SplitKeepLeft></SplitKeepLeft>
                                <SplitKeepRight></SplitKeepRight>
                                <span style="margin:auto"></span>
                                <WebCutManagerScaler></WebCutManagerScaler>
                            </div>
                        </div>
                        <WebCutManager disable-sort :aside-width="120" class="webcut-editor-webcut-manager" :rail-height-by-type="{ audio: 32, text: 24 }">
                            <template #asideRail="{ rail }">
                                <div class="webcut-editor-webcut-manager-rail-left-side">
                                    <span class="webcut-editor-webcut-manager-rail-left-side-type-icon" :class="{'webcut-editor-webcut-manager-rail-left-side-main-icon': rail.main }">
                                        <n-icon :component="Video" v-if="rail.type === 'video'"></n-icon>
                                        <n-icon :component="Music" v-if="rail.type === 'audio'"></n-icon>
                                        <n-icon :component="Image" v-if="rail.type === 'image'"></n-icon>
                                        <n-icon :component="StringText" v-if="rail.type === 'text'"></n-icon>
                                    </span>
                                    <span class="webcut-editor-webcut-manager-rail-left-side-action-icon">
                                        <n-icon :component="Unlocked" @click="handleToggleLocked(rail)" v-if="!rail.locked"></n-icon>
                                        <n-icon :component="Locked" @click="handleToggleLocked(rail)" v-if="rail.locked"></n-icon>
                                    </span>
                                    <span class="webcut-editor-webcut-manager-rail-left-side-action-icon">
                                        <n-icon :component="View" @click="toggleRailHidden(rail)" v-if="!rail.hidden && !['audio'].includes(rail.type)"></n-icon>
                                        <n-icon :component="ViewOff" @click="toggleRailHidden(rail)" v-if="rail.hidden && !['audio'].includes(rail.type)"></n-icon>
                                    </span>
                                    <span class="webcut-editor-webcut-manager-rail-left-side-action-icon">
                                        <n-icon :component="VolumeUp" @click="toggleRailMute(rail)" v-if="!rail.mute && ['video'].includes(rail.type)"></n-icon>
                                        <n-icon :component="VolumeMute" @click="toggleRailMute(rail)" v-if="rail.mute && ['video'].includes(rail.type)"></n-icon>
                                        <n-icon :component="VolumeUp" @click="toggleRailHidden(rail)" v-if="!rail.hidden && ['audio'].includes(rail.type)"></n-icon>
                                        <n-icon :component="VolumeMute" @click="toggleRailHidden(rail)" v-if="rail.hidden && ['audio'].includes(rail.type)"></n-icon>
                                    </span>
                                </div>
                            </template>
                            <template #mainSegment="{ rail, segment, railIndex, segmentIndex, segments }">
                                <div class="webcut-editor-segment">
                                    <VideoSegment v-if="rail.type === 'video'" :segment="segment" :rail="rail" :railIndex="railIndex" :segmentIndex="segmentIndex" :segments="segments"></VideoSegment>
                                    <AudioSegment v-if="rail.type === 'audio'" :segment="segment" :rail="rail" :railIndex="railIndex" :segmentIndex="segmentIndex" :segments="segments"></AudioSegment>
                                    <ImageSegment v-if="rail.type === 'image'" :segment="segment" :rail="rail" :railIndex="railIndex" :segmentIndex="segmentIndex" :segments="segments"></ImageSegment>
                                    <TextSegment v-if="rail.type === 'text'" :segment="segment" :rail="rail" :railIndex="railIndex" :segmentIndex="segmentIndex" :segments="segments"></TextSegment>
                                </div>
                            </template>
                        </WebCutManager>
                    </div>
                </template>
                <template #resize-trigger>
                    <div class="webcut-editor-split-resize-trigger--horizontal"></div>
                </template>
            </n-split>
        </div>
        <slot name="footer"></slot>
    </WebCutProvider>
</template>

<style scoped lang="less">
.webcut-editor {
    position: relative;
    height: 100%;
    width: 100%;
}
// .webcut-editor-actions {
//     position: absolute;
//     top: 2px;
//     right: 0;
//     z-index: 0;
//     transition: right .2s;
//     display: flex;
//     flex-direction: column;
//     gap: 4px;

//     .video-app--aside-hidden & {
//         right: 60px;
//     }

//     :deep(.n-button__content) {
//         color: var(--text-color-3);
//     }
// }
// .webcut-editor-actions--selected {
//     background-color: var(--webcut-grey-color) !important;
//     :deep(.n-button__content) {
//         color: var(--primary-color);
//     }
// }
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
}
.webcut-editor-video-player-buttons-right {
    right: 0;
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
    gap: 4px;
    align-items: center;
    justify-content: space-between;
    padding: 4px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-editor-right-side-main {
    flex: 1;
    overflow: auto;
}
.webcut-editor-tools-bar {
    display: flex;
    align-items: center;
    height: 28px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-editor-tools-bar-left {
    width: 120px;
    height: 100%;
    border-right: 1px solid var(--webcut-line-color);
}
.webcut-editor-tools-bar-right {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    padding: 4px;
    margin-right: 8px;
    margin-left: 4px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-editor-bottom-side {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.webcut-editor-webcut-manager {
    flex: 1;
}

.webcut-editor-left-side {
    height: 100%;
    overflow: hidden;
}

.webcut-editor-segment {
    width: 100%;
    height: 100%;
}

.webcut-editor-right-side-top-bar-export-button {
    height: 18px;
    font-size: .7em;
}
.webcut-editor-webcut-manager-rail-left-side {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-left: -8px;

    span {
        width: 1em;
        height: 1em;
    }
}
.webcut-editor-webcut-manager-rail-left-side-type-icon {
    opacity: .3;
}
.webcut-editor-webcut-manager-rail-left-side-main-icon {
    color: var(--primary-color);
}
.webcut-editor-webcut-manager-rail-left-side-action-icon {
    transition: color .2s;
}
.webcut-editor-webcut-manager-rail-left-side-action-icon:hover {
    color: var(--primary-color);
}
</style>
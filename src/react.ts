/**
 * WebCut React 接口层（基于 veaury 桥接）
 *
 * WebCut 内部实现保持 Vue 3，本文件通过 veaury 的 applyVueInReact
 * 将全部视图组件包装为可直接在 React 中使用的组件。
 *
 * 用法：
 * ```tsx
 * import { WebCutEditor } from 'webcut/react';
 * import 'webcut/react/style.css';
 *
 * <WebCutEditor projectId="xxx" />
 * ```
 *
 * 桥接约定：
 * - v-model（如 v-model:is-dark-mode）→ React 侧传值 prop + onUpdateXxx 回调
 *   例：`<WebCutProvider isDarkMode={dark} onUpdateIsDarkMode={setDark} />`
 * - 具名插槽（header / footer / rightTopBar 等）→ 同名 ReactNode prop
 * - 默认插槽 → children
 * - Vue 组合式 API（useWebCutContext 等 hooks）无法在 React 组件中调用，
 *   请通过组件组合使用；纯工具函数 / 类型已原样透传。
 */
import { createElement } from 'react';
import type * as React from 'react';
import { applyVueInReact } from 'veaury';

// ---------------- Vue 组件导入 ----------------
// 全局
import WebCutProviderVue from './views/provider/index.vue';
import WebCutLangSwitchVue from './views/lang-switch/index.vue';
import WebCutThemeSwitchVue from './views/theme-switch/index.vue';
import WebCutLoadingVue from './views/loading/index.vue';
import WebCutToastVue from './views/toast/index.vue';
import WebCutThemeBoxVue from './views/theme-box/index.vue';
// 导出
import WebCutExportButtonVue from './views/export-button/index.vue';
import WebCutExportVue from './modules/advanced-export/index.vue';
import WebCutExportPanelVue from './modules/advanced-export/export-panel.vue';
import WebCutExportModalVue from './modules/advanced-export/export-modal.vue';
// 播放器
import WebCutPlayerVue from './views/player/index.vue';
import WebCutPlayerScreenVue from './views/player/screen.vue';
import WebCutPlayerButtonVue from './views/player/button.vue';
import WebCutSelectAspectRatioVue from './views/select-aspect-ratio/index.vue';
import WebCutSelectResolutionVue from './views/select-resolution/index.vue';
import WebCutSelectFpsVue from './views/select-fps/index.vue';
import WebCutTimeClockVue from './views/time-clock/index.vue';
// 管理器
import WebCutManagerVue from './views/manager/index.vue';
import WebCutManagerContainerVue from './views/manager/container/index.vue';
import WebCutManagerScalerVue from './views/manager/scaler/index.vue';
import WebCutManagerAsideRailVue from './views/manager/aside/index.vue';
import WebCutManagerMainSegmentVue from './views/manager/main/index.vue';
import WebCutManagerToolBarVue from './views/manager/tool-bar/index.vue';
// 管理器-素材
import WebCutVideoSegmentVue from './views/manager/segments/video.vue';
import WebCutAudioSegmentVue from './views/manager/segments/audio.vue';
import WebCutImageSegmentVue from './views/manager/segments/image.vue';
import WebCutTextSegmentVue from './views/manager/segments/text.vue';
// 管理器-工具
import WebCutClearToolVue from './views/tools/clear/index.vue';
import WebCutDeleteToolVue from './views/tools/delete/index.vue';
import WebCutSplitToolVue from './views/tools/split/index.vue';
import WebCutSplitKeepLeftToolVue from './views/tools/split-keep-left/index.vue';
import WebCutSplitKeepRightToolVue from './views/tools/split-keep-right/index.vue';
import WebCutFlipHorizontalToolVue from './views/tools/flip-h/index.vue';
import WebCutConcatToolVue from './views/tools/concat/index.vue';
// 面板
import WebCutPanelVue from './views/panel/index.vue';
import WebCutBasicPanelVue from './views/panel/basic/index.vue';
import WebCutTextPanelVue from './views/panel/text/index.vue';
import WebCutAudioPanelVue from './views/panel/audio/index.vue';
import WebCutVideoPanelVue from './views/panel/video/index.vue';
import WebCutFilterPanelVue from './views/panel/filter/index.vue';
import WebCutAnimationPanelVue from './views/panel/animation/index.vue';
// 素材库
import WebCutLibraryVue from './views/library/index.vue';
import WebCutLibraryAsideVue from './views/library/_shared/aside.vue';
import WebCutLibraryImportVue from './views/library/_shared/import.vue';
import WebCutLibraryListVue from './views/library/_shared/list.vue';
import WebCutLibraryContainerVue from './views/library/_shared/container.vue';
// 编辑器
import WebCutEditorVue from './views/editor/index.vue';

// ---------------- 桥接工厂 ----------------

export interface VueInReactBridgeOptions {
    /** 显示名 */
    displayName?: string;
    /** 声明为具名插槽的 ReactNode props（透传为 v-slots） */
    slotProps?: string[];
}

/**
 * 将 Vue 组件包装为 React 组件，并提供：
 * - onUpdateXxx（React 风格回调）→ Vue emit('update:xxx')，即 v-model 桥
 * - slotProps 声明的 ReactNode props → v-slots 具名插槽
 * - children → 默认插槽
 *
 * 同时作为通用桥接工厂导出：React 宿主可用它把「基于 webcut Vue hooks 的自有容器组件」
 * （webcut 组合式 API 无法在 React 中调用，只能封装为 Vue 容器再桥接）包装为 React 组件。
 */
export function vueInReact(VueComponent: any, options: VueInReactBridgeOptions = {}) {
    const Base = applyVueInReact(VueComponent);
    const { displayName, slotProps = [] } = options;

    function Bridged(props: Record<string, any>) {
        const { children, ...rest } = props;
        const passthrough: Record<string, any> = {};
        const vSlots: Record<string, any> = {};

        for (const key of Object.keys(rest)) {
            const value = rest[key];
            if (value === undefined) {
                continue;
            }
            // onUpdateXxx → 'onUpdate:xxx'（v-model 受控回调桥）
            if (key.length > 8 && key.startsWith('onUpdate')) {
                const model = key.slice(8);
                const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
                passthrough[`onUpdate:${modelKey}`] = value;
                continue;
            }
            // 声明的具名插槽
            if (slotProps.includes(key)) {
                if (value !== null && value !== false) {
                    vSlots[key] = typeof value === 'function' && !('$$typeof' in value) ? value : () => value;
                }
                continue;
            }
            passthrough[key] = value;
        }

        // children → 默认插槽
        if (children !== undefined && children !== null && children !== false) {
            vSlots.default = typeof children === 'function' ? children : () => children;
        }

        if (Object.keys(vSlots).length > 0) {
            passthrough['v-slots'] = vSlots;
        }

        return createElement(Base as React.ComponentType<any>, passthrough);
    }

    Bridged.displayName = displayName || 'WebCutVueInReact';
    return Bridged as React.ComponentType<Record<string, any>>;
}

// ---------------- React 组件导出 ----------------

/** 全局 Provider（v-model:isDarkMode / v-model:language） */
export const WebCutProvider = vueInReact(WebCutProviderVue, {
    displayName: 'WebCutProvider',
});

/**
 * 完整编辑器（高度集成：播放器、素材库、时间轴、面板、工具栏）
 * v-model:darkMode / v-model:language；插槽 header / footer / rightTopBar
 */
export const WebCutEditor = vueInReact(WebCutEditorVue, {
    displayName: 'WebCutEditor',
    slotProps: ['header', 'footer', 'rightTopBar'],
});

// 播放器
export const WebCutPlayer = vueInReact(WebCutPlayerVue, { displayName: 'WebCutPlayer' });
export const WebCutPlayerScreen = vueInReact(WebCutPlayerScreenVue, { displayName: 'WebCutPlayerScreen' });
export const WebCutPlayerButton = vueInReact(WebCutPlayerButtonVue, { displayName: 'WebCutPlayerButton' });
export const WebCutSelectAspectRatio = vueInReact(WebCutSelectAspectRatioVue, { displayName: 'WebCutSelectAspectRatio' });
export const WebCutSelectResolution = vueInReact(WebCutSelectResolutionVue, { displayName: 'WebCutSelectResolution' });
export const WebCutSelectFps = vueInReact(WebCutSelectFpsVue, { displayName: 'WebCutSelectFps' });
export const WebCutTimeClock = vueInReact(WebCutTimeClockVue, { displayName: 'WebCutTimeClock' });

// 管理器
export const WebCutManager = vueInReact(WebCutManagerVue, { displayName: 'WebCutManager' });
export const WebCutManagerContainer = vueInReact(WebCutManagerContainerVue, { displayName: 'WebCutManagerContainer' });
export const WebCutManagerScaler = vueInReact(WebCutManagerScalerVue, { displayName: 'WebCutManagerScaler' });
export const WebCutManagerAsideRail = vueInReact(WebCutManagerAsideRailVue, { displayName: 'WebCutManagerAsideRail' });
export const WebCutManagerMainSegment = vueInReact(WebCutManagerMainSegmentVue, { displayName: 'WebCutManagerMainSegment' });
export const WebCutManagerToolBar = vueInReact(WebCutManagerToolBarVue, { displayName: 'WebCutManagerToolBar' });

// 管理器-素材 segment
export const WebCutVideoSegment = vueInReact(WebCutVideoSegmentVue, { displayName: 'WebCutVideoSegment' });
export const WebCutAudioSegment = vueInReact(WebCutAudioSegmentVue, { displayName: 'WebCutAudioSegment' });
export const WebCutImageSegment = vueInReact(WebCutImageSegmentVue, { displayName: 'WebCutImageSegment' });
export const WebCutTextSegment = vueInReact(WebCutTextSegmentVue, { displayName: 'WebCutTextSegment' });

// 管理器-工具
export const WebCutClearTool = vueInReact(WebCutClearToolVue, { displayName: 'WebCutClearTool' });
export const WebCutDeleteTool = vueInReact(WebCutDeleteToolVue, { displayName: 'WebCutDeleteTool' });
export const WebCutSplitTool = vueInReact(WebCutSplitToolVue, { displayName: 'WebCutSplitTool' });
export const WebCutSplitKeepLeftTool = vueInReact(WebCutSplitKeepLeftToolVue, { displayName: 'WebCutSplitKeepLeftTool' });
export const WebCutSplitKeepRightTool = vueInReact(WebCutSplitKeepRightToolVue, { displayName: 'WebCutSplitKeepRightTool' });
export const WebCutFlipHorizontalTool = vueInReact(WebCutFlipHorizontalToolVue, { displayName: 'WebCutFlipHorizontalTool' });
export const WebCutConcatTool = vueInReact(WebCutConcatToolVue, { displayName: 'WebCutConcatTool' });

// 面板
export const WebCutPanel = vueInReact(WebCutPanelVue, { displayName: 'WebCutPanel' });
export const WebCutBasicPanel = vueInReact(WebCutBasicPanelVue, { displayName: 'WebCutBasicPanel' });
export const WebCutTextPanel = vueInReact(WebCutTextPanelVue, { displayName: 'WebCutTextPanel' });
export const WebCutAudioPanel = vueInReact(WebCutAudioPanelVue, { displayName: 'WebCutAudioPanel' });
export const WebCutVideoPanel = vueInReact(WebCutVideoPanelVue, { displayName: 'WebCutVideoPanel' });
export const WebCutFilterPanel = vueInReact(WebCutFilterPanelVue, { displayName: 'WebCutFilterPanel' });
export const WebCutAnimationPanel = vueInReact(WebCutAnimationPanelVue, { displayName: 'WebCutAnimationPanel' });

// 素材库
export const WebCutLibrary = vueInReact(WebCutLibraryVue, { displayName: 'WebCutLibrary' });
export const WebCutLibraryAside = vueInReact(WebCutLibraryAsideVue, { displayName: 'WebCutLibraryAside' });
export const WebCutLibraryImport = vueInReact(WebCutLibraryImportVue, { displayName: 'WebCutLibraryImport' });
export const WebCutLibraryList = vueInReact(WebCutLibraryListVue, { displayName: 'WebCutLibraryList' });
export const WebCutLibraryContainer = vueInReact(WebCutLibraryContainerVue, { displayName: 'WebCutLibraryContainer' });

// 全局辅助
export const WebCutLangSwitch = vueInReact(WebCutLangSwitchVue, { displayName: 'WebCutLangSwitch' });
export const WebCutThemeSwitch = vueInReact(WebCutThemeSwitchVue, { displayName: 'WebCutThemeSwitch' });
export const WebCutLoading = vueInReact(WebCutLoadingVue, { displayName: 'WebCutLoading' });
export const WebCutToast = vueInReact(WebCutToastVue, { displayName: 'WebCutToast' });
export const WebCutThemeBox = vueInReact(WebCutThemeBoxVue, { displayName: 'WebCutThemeBox' });

// 导出
export const WebCutExportButton = vueInReact(WebCutExportButtonVue, { displayName: 'WebCutExportButton' });
export const WebCutExport = vueInReact(WebCutExportVue, { displayName: 'WebCutExport' });
export const WebCutExportPanel = vueInReact(WebCutExportPanelVue, { displayName: 'WebCutExportPanel' });
export const WebCutExportModal = vueInReact(WebCutExportModalVue, { displayName: 'WebCutExportModal' });

// ---------------- 框架无关导出（工具函数 / 类型） ----------------

export {
    renderTxt2ImgBitmap,
    createTxt2Img,
    buildTextAsDOM,
    cssToText,
    textToCss,
    measureAudioDuration,
    measureImageSize,
    measureTextSize,
    measureVideoDuration,
    measureVideoSize,
    autoFitRect,
    formatTime,
    mp4ClipToBlob,
    mp4ClipToFile,
    audioClipToFile,
    pcmToWav,
    exportBlobOffscreen,
    exportAsWavBlobOffscreen,
    mp4BlobToWavArrayBuffer,
    mp4BlobToWavBlob,
    mp4ClipToAudioClip,
    mp4ClipToFramesData,
    createImageFromVideoFrame,
    progressiveClipToPCMData,
    downloadOffscreen,
    createTrackedVideoFrame,
    closeTrackedVideoFrame,
    safeCloseFrame,
    withVideoFrame,
    trackVideoFrameCreated,
    trackVideoFrameClosed,
    getVideoFrameStats,
} from './libs';
export {
    base64ToFile,
    blobToBase64DataURL,
    fileToBase64DataURL,
    downloadBlob,
    getFileMd5,
    blobToFile,
} from './libs/file';
export {
    loadFFmpeg,
    isFFmpegLoaded,
    execFFmpeg,
    runFFmpeg,
    transcodeToMP4ByFFmpeg,
    sliceByFFmpeg,
    extractAudioFromVideo,
    setFFmpegScripts,
} from './libs/ffmpeg';
export {
    remuxToMp4,
    sliceMediaByRemux,
    composeSpeedChangedVideo,
} from './libs/remux';
export { extractAudioByRemux } from './libs/split-av';

// transitions / filters / animations
export {
    transitionManager,
    WebCutBaseTransition,
} from './modules/transitions';
export {
    filterManager,
    WebCutBaseFilter,
} from './modules/filters';
export {
    animationManager,
    WebCutBaseAnimation,
    WebCutAnimationManager,
} from './modules/animations';

// i18n（纯函数部分）
export {
    appendLangPkg,
    mergeLangPkg,
    mapLangPkg,
    getLangPkg,
    getLangPkgsMap,
    getLangLabelsMap,
} from './i18n/core';

// constants
export { aspectRatioMap, aspectRatioResolutionMaps, RESOLUTIONS, FPS_OPTIONS, ASPECT_RATIOS } from './constants';
export type { WebCutAspectRatio } from './constants';
export { inferCanvasFromVideo, nearestFpsOption, probeVideoFps } from './libs';

// db（持久化，纯函数）
export {
    getProject,
    listProjects,
    createNewProject,
    renameProject,
    deleteProject,
    addFileToProject,
    removeFileFromProject,
    removeFileEverywhere,
    writeFile,
    readFile,
    addFile,
    getFile,
    getAllFiles,
    moveProjectHistoryTo,
    moveProjectHistoryToId,
    pushProjectHistory,
    pushProjectHistoryEntry,
    getProjectHistory,
    clearProjectHistory,
    clearProjectHistory as clearWebCutHistory,
    getProjectState,
    updateProjectState,
} from './db';

// 类型（供 React 侧 props 标注使用）
export type {
    WebCutContext,
    WebCutHighlightOfText,
    WebCutSegmentOfText,
    WebCutRailOfText,
    WebCutThingType,
    WebCutSegment,
    WebCutRail,
    WebCutMaterialType,
    WebCutMaterial,
    WebCutSourceMeta,
    WebCutSource,
    WebCutSourceData,
    WebCutProjectHistoryState,
    WebCutProjectHistoryPatchOperation,
    WebCutProjectHistoryPatch,
    WebCutProjectHistoryData,
    WebCutProjectHistoryPushPayload,
    WebCutColors,
    WebCutAnimationType,
    WebCutAnimationKeyframe,
    WebCutAnimationKeyframeConfig,
    WebCutAnimationParams,
    WebCutAnimationData,
    WebCutTransitionData,
    WebCutFilterData,
    WebCutExtensionPack,
} from './types';

export type {
    WebCutExportAudioParams,
    WebCutExportVideoParams,
} from './modules/advanced-export/types';

// 注意：Vue 组合式 API hooks（useWebCutContext / useWebCutPlayer 等）与
// agent dock pack（createWebCutAgentPack）依赖 Vue 运行时的组件上下文，
// 不能在 React 组件中调用，故不在本入口导出；
// 如需在 React 中深定制，请通过组合上述 React 组件实现。

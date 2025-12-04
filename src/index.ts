import WebCutProvider from './views/provider/index.vue';
import WebCutPlayerScreen from './views/player/screen.vue';
import WebCutPlayerButton from './views/player/button.vue';
import WebCutManager from './views/manager/index.vue';
import WebCutManagerScaler from './views/manager/scaler/index.vue';
import WebCutPlayer from './views/player/index.vue';
import WebCutSelectAspectRatio from './views/select-aspect-ratio/index.vue';
import WebCutLibrary from './views/library/index.vue';
import WebCutVideoSegment from './views/manager/segments/video.vue';
import WebCutAudioSegment from './views/manager/segments/audio.vue';
import WebCutImageSegment from './views/manager/segments/image.vue';
import WebCutTextSegment from './views/manager/segments/text.vue';
import WebCutClearSelectedTool from './views/tools/clear-selected/index.vue';
import WebCutDeleteCurrentTool from './views/tools/delete-current/index.vue';
import WebCutSplitCurrentTool from './views/tools/split-current/index.vue';
import WebCutSplitKeepLeftTool from './views/tools/split-keep-left/index.vue';
import WebCutSplitKeepRightTool from './views/tools/split-keep-right/index.vue';
import WebCutPanel from './views/panel/index.vue';
import WebCutTextPanel from './views/panel/text/index.vue';
import WebCutBasicPanel from './views/panel/basic/index.vue';
import WebCutEditor from './views/editor/index.vue';
import WebCutTimeClock from './views/time-clock/index.vue';
import WebCutExportButton from './views/export-button/index.vue';

import WebCutThemeSwitch from './views/theme-switch/index.vue';
import AdjustableBox from './components/adjustable-box/index.vue';
import AudioShape from './components/audio-shape/index.vue';
import ContextMenu from './components/context-menu/index.vue';
import ScrollBox from './components/scroll-box/index.vue';
import DraggableHandler from './components/draggable-handler/index.vue';
import RotateInput from './components/rotate-input/index.vue';

export {
    WebCutProvider,
    WebCutPlayerScreen,
    WebCutPlayerButton,
    WebCutPlayer,
    WebCutManager,
    WebCutManagerScaler,
    WebCutVideoSegment,
    WebCutAudioSegment,
    WebCutImageSegment,
    WebCutTextSegment,
    WebCutClearSelectedTool,
    WebCutDeleteCurrentTool,
    WebCutSplitCurrentTool,
    WebCutSplitKeepLeftTool,
    WebCutSplitKeepRightTool,
    WebCutEditor,
    WebCutSelectAspectRatio,
    WebCutTimeClock,
    WebCutLibrary,
    WebCutPanel,
    WebCutTextPanel,
    WebCutBasicPanel,
    WebCutThemeSwitch,
    WebCutExportButton,

    AdjustableBox,
    AudioShape,
    ContextMenu,
    ScrollBox,
    DraggableHandler,
    RotateInput,
};

export {
    useScrollBox,
} from './components/scroll-box';

export {
    useWebCutContext,
    useWebCutPlayer,
    useWebCutData,
    useWebCutThemeColors,
    useWebCutDarkMode,
} from './hooks';
export {
    useWebCutManager,
} from './hooks/manager';
export {
    useWebCutLibrary,
} from './hooks/library';
export {
    useWebCutLocalFile,
} from './hooks/local-file';

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
    getProject,
    createNewProject,
    addFileToProject,
    removeFileFromProject,
    writeFile,
    readFile,
    addFile,
    getFile,
    getAllFiles,
    moveProjectHistoryTo,
    pushProjectHistory,
    getProjectHistory,
    clearProjectHistory,
    getProjectState,
    setProjectState,
} from './db';

export {
    type WebCutContext,
    type WebCutHighlightOfText,
    type WebCutSegmentOfText,
    type WebCutRailOfText,
    type WebCutSegment,
    type WebCutRail,
    type WebCutMaterialType,
    type WebCutMaterial,
    type WebCutMaterialMeta,
    type WebCutSource,
    type WebCutSourceMeta,
    type WebCutHistoryState,
    type WebCutColors,
} from './types';

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

import WebCutThemeSwitch from './views/dark-mode/theme-switch.vue';
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

    AdjustableBox,
    AudioShape,
    ContextMenu,
    ScrollBox,
    DraggableHandler,
    RotateInput,
};

export * from './views/dark-mode/hooks';
export * from './components/scroll-box';

export * from './hooks';
export * from './hooks/manager';
export * from './hooks/library';
export * from './hooks/local-file';

export * from './libs';
export * from './libs/media';
export * from './libs/file';

export * from './db';

export * from './types';

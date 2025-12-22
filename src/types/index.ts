import { AVCanvas } from '@webav/av-canvas';
import { VisibleSprite, MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper';
import { Evt } from '../libs/evt';
import { Component } from 'vue';

export type WebCutContext = {
    // 项目id
    id: string;

    // canvas 宽度
    width: number;
    // canvas 高度
    height: number;

    // canvas容器
    viewport: HTMLDivElement | null;
    // avcanvas 实例
    canvas: AVCanvas | null;
    // 素材对象列表，key为素材id
    clips: Array<MP4Clip | ImgClip | AudioClip>;
    // 素材列表，即经过剪辑后可用于播放的素材列表，key为素材id
    sprites: Array<VisibleSprite>;
    // 记录素材与原始素材的对应关系
    sources: Map<string, WebCutSource>;

    // 当前播放位置，纳秒，1000*1000=1秒
    cursorTime: number;
    // 是否播放中, -1: 停止， 0: 暂停/初始态， 1: 播放
    status: -1 | 0 | 1;
    // 总时长
    duration: number;

    // 禁用选中素材
    disableSelectSprite: boolean;
    // 当结束停止时，自动reset为第一帧
    autoResetWhenStop: boolean;

    // 帧率
    fps: number;

    // 时间轴缩放比例, [0, 100], step:10
    scale: number;

    /** 时间轴滚动条1 */
    scroll1: null | any;
    /** 时间轴滚动条2 */
    scroll2: null | any;
    /** 时间轴标尺 */
    ruler: null | any;
    /** 时间轴管理器 */
    manager: null | any;

    /** 播放器 */
    player: any | null;

    /** 轨 */
    rails: WebCutRail[];
    /** 选中的segment */
    selected: {
        segmentId: string;
        railId: string;
    }[];
    /** 当前选中的segment或transition，用于编辑区域编辑 */
    current: null | {
        railId: string;
        segmentId?: string;
        transitionId?: string;
    };
    editTextState: null | {
        isActive: boolean;
        sourceKey: string;
        text: string;
    };

    canUndo: boolean;
    canRedo: boolean;
    canRecover: boolean;

    // 是否展示loading组件
    loading: boolean;

    evt: Evt;

    /** 外部注册的模块列表 */
    modules: Map<new () => WebCutExtensionPack, WebCutExtensionPack>;

    /** 内存缓存，用于存储一些临时数据，而且需要注意，使用markRaw标记，避免vue对其进行响应式处理 */
    memory: Record<string, any>;
};

export interface WebCutExtensionPack {
    /** 素材配置 */
    materialConfig?: {
        /** 在素材库中进行注册 */
        name: string;
        /** 素材库顶部、规定左侧显示的图标 */
        icon: Component;
        /** 显示名 */
        displayName: string;
        /** 素材类型，用于在push到canvas中时用来进行判断的标识 */
        materialType: WebCutMaterialType;
        /**
         * 资源类型，用于控制rail中应该保持同一素材
         * 需要注意，一种thingType，只能被注册一次，且不可以注册内置的4种type
         */
        thingType: WebCutThingType;
        /** 素材库组件 */
        libraryComponent: Component;
    };
    /** 素材库配置 */
    libraryConfig?: {
        /** 在素材库中注册新的导航项 */
        navs: {
            /** 目标素材，可以是自定义的素材 */
            targetThing: WebCutThingType;
            /** 插入位置 */
            insertBeforeIndex: number;
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** 轨道管理器配置 */
    managerConfig?: {
        /** 是否满足条件，在manager中使用本模块 */
        is: (rail: WebCutRail) => boolean;
        /** 轨道高度，根据类型不同而不同 */
        height?: number;
        segment?: {
            /** 是否禁用时间轴调整 */
            disableChangeTiming?: boolean;
            component?: Component;
        },
        aside?: {
            component?: Component;
            // 是否开启下面这些功能，默认不开启
            lock?: boolean;
            hide?: boolean;
            mute?: boolean;
        },
    };
    /** 右侧编辑面板 */
    panelConfig?: {
        tabs?: {
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** 语言包 */
    languagePackages?: Record<string, Record<string, string>>;
    /** 初始化模块 */
    onRegister?(context: WebCutContext): Promise<void>;
    /** 素材被push到轨道上时调用 */
    onPush?(source: WebCutSource): Promise<void>;
    /** 在push新轨道时，对轨道排序进行二次处理 */
    onSortRails?(rails: WebCutRail[]): WebCutRail[];
}

export type WebCutHighlightOfText = {
    id: string;
    content: string;
    start: number;
    end: number;
    css: any;
}

export type WebCutSegmentOfText = WebCutSegment & {
    text: string;
    css?: any;
    highlights?: WebCutHighlightOfText[];
}

export type WebCutRailOfText = WebCutRail & {
    segments: WebCutSegmentOfText[];
    css?: any;
    print_mode?: string;
    print_css?: any;
}

export type WebCutSegment = {
    id: string;
    start: number;
    end: number;
    /** 存到sources中的key */
    sourceKey: string;
    [key: string]: any;
};

export type WebCutRail = {
    id: string;
    type: WebCutThingType;
    segments: WebCutSegment[];
    /** 轨道上的转场效果列表 */
    transitions: WebCutTransitionData[];
    mute?: boolean;
    hidden?: boolean;
    locked?: boolean;
    [key: string]: any;
};

/**
 * 素材类型主要指被push到avcanvas中的素材类型，目前仅支持视频、音频、图片、文本
 * 对象类型是我们用来进行管理的一种类型，用于区分不同的对象，它的作用主要有：
 * 1. rail拥有thingType（rail.type)，用于判断素材是否可以被push到轨道上，在素材从一个rail移动到另外一个rail上时，作为判断依据
 * 2. source.meta.thingType，用于记录segment的thingType
 */
// 素材类型
export type WebCutMaterialType = 'video' | 'audio' | 'image' | 'text';
// 对象类型
export type WebCutThingType = string;

export interface WebCutMaterial {
    id: string;
    type: WebCutMaterialType;
    name: string;
    size: number;
    time: number;
    tags?: string[]; // 对素材打标签，同一type下的素材可以根据标签进行分类。兼容老版本的数据。
};

// -----------------------------------------------------------

// 转场效果
export interface WebCutTransitionData {
    id: string;
    /** 转场效果名（在transitionManager中注册的名称） */
    name: string;
    /** 转场开始时间（在轨道上的绝对时间） */
    start: number;
    /** 转场结束时间（在轨道上的绝对时间） */
    end: number;
    /** 转场效果配置 */
    config?: Record<string, any>;
    sourceKeys?: string[];
}

// -----------------------------------------------------------

// 滤镜
export interface WebCutFilterData {
    id: string;
    /** 滤镜名称（在filterManager中注册的名称） */
    name: string;
    /** 滤镜参数 */
    params?: Record<string, any>;
}

// -----------------------------------------------------------

// 动画类型定义
export enum WebCutAnimationType {
    /** 入场动画 */
    Enter = 'enter',
    /** 出场动画 */
    Exit = 'exit',
    /** 运动动画 */
    Motion = 'motion',
};

/**
 * 动画关键帧数据（用于存储和实际渲染）
 */
export type WebCutAnimationKeyframe = Partial<Record<`${number}%` | 'from' | 'to', {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    angle?: number;
    opacity?: number;
}>>;

/**
 * 动画关键帧配置
 */
export type WebCutAnimationKeyframeConfig = Partial<Record<`${number}%` | 'from' | 'to', {
    /** 相对于素材当前位置的x偏移量 */
    offsetX?: number;
    /** 相对于素材当前位置的y偏移量 */
    offsetY?: number;
    /** 相对于当前w,h的缩放比例 */
    scale?: number;
    /** 相对于当前angle的旋转角度 */
    rotate?: number;

    /** 绝对位置x */
    x?: number;
    /** 绝对位置y */
    y?: number;
    /** 宽度 */
    w?: number;
    /** 高度 */
    h?: number;
    /** 角度 */
    angle?: number;
    /** 透明度 */
    opacity?: number;
}>>;

/**
 * 动画参数类型
 */
export interface WebCutAnimationParams {
    /** 动画持续时间（微秒） */
    duration: number;
    /** 动画延迟时间（微秒） */
    delay: number;
    /** 动画重复次数，0为无限循环 */
    iterCount: number;
}

// 动画配置
export interface WebCutAnimationData {
    /** 动画名称，preset id */
    name: string;
    /** 动画类型 */
    type: WebCutAnimationType | string;
    /** 动画参数 */
    params: WebCutAnimationParams;
    /** 动画关键帧 */
    keyframe: WebCutAnimationKeyframe;
}

// -----------------------------------------------------------

/**
 * 素材元数据
 * 用于存储素材的位置信息、透明度、可见性等
 * 需要注意，当素材存在animation时，meta中的上述元数据信息与sprite上的真实值可能会有差异，
 * 因为animation会实时调整sprite的属性值，而元数据则保存了不考虑animation下的初始值，
 * 切换任意的animation都是在初始值的基础上进行叠加，而非在上一个animation的值的基础上叠加
 */
export type WebCutSourceMeta = {
    id?: string;
    thingType?: WebCutThingType;

    /** 素材的位置信息 */
    rect?: Partial<{
        x: number;
        y: number;
        w: number;
        h: number;
        angle: number;
    }>,
    zIndex?: VisibleSprite['zIndex'];
    opacity?: VisibleSprite['opacity'];
    flip?: VisibleSprite['flip'];
    visible?: VisibleSprite['visible'];
    interactable?: VisibleSprite['interactable'];

    time?: {
        /** 在时间轴中的开始时间 */
        start?: number;
        /** 在时间轴中的持续时间 */
        duration?: number;
        /** 播放速率，1为正常速率，0.5为半速，2为双倍速 */
        playbackRate?: number;
    },

    /** 动画 */
    animation?: WebCutAnimationData | null;

    audio?: {
        /** 偏移时间，即音频将从该位置进行播放，单位：纳秒 */
        offset?: number;
        volume?: number;
        loop?: boolean;
    },
    video?: {
        /** 偏移时间，即视频将从该位置进行播放，单位：纳秒 */
        offset?: number;
        volume?: number;
    },
    text?: {
        css?: object;
        highlights?: WebCutHighlightOfText[];
    },

    /** 滤镜配置数组，支持包含参数的对象形式 */
    filters?: WebCutFilterData[];

    /** 自动调整视频尺寸到容器内，仅对视频和图片有效，带_scale后缀表示当图片小于视频视口时，会把图片放大以撑满整个视口 */
    autoFitRect?: 'contain' | 'cover' | 'contain_scale' | 'cover_scale';
    /** 添加到指定轨道 */
    withRailId?: string;
    /** 用指定id作为新segment的id，主要用在恢复之前的历史记录时 */
    withSegmentId?: string;
};

export type WebCutSource = {
    key: string;
    type: WebCutMaterialType; // 注意这里，source.type是素材的类型，不是thingType，thingType要到meta中取
    clip: MP4Clip | ImgClip | AudioClip;
    sprite: VisibleSprite;
    text?: string;
    fileId?: string;
    url?: string;
    railId: string;
    segmentId?: string;
    transationId?: string;
    meta: WebCutSourceMeta;
};

// 将source数据化，用于存储到db
export type WebCutSourceData = Omit<WebCutSource, 'clip' | 'sprite'> & {
    sprite: {
        time: VisibleSprite['time'];
        rect: {
            x: VisibleSprite['rect']['x'],
            y: VisibleSprite['rect']['y'],
            w: VisibleSprite['rect']['w'],
            h: VisibleSprite['rect']['h'],
            angle: VisibleSprite['rect']['angle'],
        };
        zIndex: VisibleSprite['zIndex'];
        opacity: VisibleSprite['opacity'];
        flip: VisibleSprite['flip'];
        visible: VisibleSprite['visible'];
        interactable: VisibleSprite['interactable'];
    },
    clip: {
        meta: MP4Clip['meta'] | ImgClip['meta'] | AudioClip['meta'];
    },
};

/** 项目状态数据，存在数据库中 */
export type WebCutProjectState = {
    historyAt: string;
    aspectRatio: string;
};

export type WebCutProjectHistoryState = {
    rails: WebCutRail[];
    sources: Record<string, WebCutSourceData>;
};

export type WebCutProjectHistoryData = {
    id: string;
    projectId: string;
    timestamp: number;
    state: WebCutProjectHistoryState;
}

export interface WebCutColors {
    primaryColor: string,
    primaryColorHover: string,
    primaryColorPressed: string,
    primaryColorSuppl: string,
    textColor: string,
    textColorHover: string,
    textColorDark: string,
    textColorDarkHover: string,

    backgroundColor: string,
    backgroundColorDark: string,
    greyColor: string,
    greyColorDark: string,
    greyDeepColor: string,
    greyDeepColorDark: string,

    railBgColor: string,
    railBgColorDark: string,
    /** 轨道悬停颜色 */
    railHoverBgColor: string,
    /** 轨道悬停颜色（暗色主题） */
    railHoverBgColorDark: string,
    lineColor: string,
    lineColorDark: string,
    thumbColor: string,
    thumbColorDark: string,
    managerTopBarColor: string,
    managerTopBarColorDark: string,
    closeIconColor: string,
    closeIconColorDark: string,
}

export interface WebCutProjectData {
    id: string;
    name: string;
    files: WebCutProjectFile[];
}

export interface WebCutProjectFile {
    id: string;
    time: number;
}

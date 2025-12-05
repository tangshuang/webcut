import { AVCanvas } from '@webav/av-canvas';
import { VisibleSprite, MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper';

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
    /** 当前选中的segment id，用于编辑区域编辑 */
    current: null | string;

    canUndo: boolean;
    canRedo: boolean;
};

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
    type: WebCutMaterialType;
    segments: WebCutSegment[];
    mute?: boolean;
    hidden?: boolean;
    locked?: boolean;
    [key: string]: any;
};

// 素材类型定义
export type WebCutMaterialType = 'video' | 'audio' | 'image' | 'text';

export interface WebCutMaterial {
  id: string;
  name: string;
  type: WebCutMaterialType;
  url: string;
  size: number;
  duration?: number; // 视频和音频的时长
  width?: number; // 图片和视频的宽度
  height?: number; // 图片和视频的高度
  createdAt: number;
  updatedAt: number;
};

export type WebCutMaterialMeta = {
    id?: string;
    rect?: Partial<{
        x: number;
        y: number;
        w: number;
        h: number;
        angle: number;
    }>,
    time?: {
        /** 在时间轴中的开始时间 */
        start?: number;
        /** 在时间轴中的持续时间 */
        duration?: number;
        /** 播放速率，1为正常速率，0.5为半速，2为双倍速 */
        playbackRate?: number;
    },
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
    zIndex?: number;
    flip?: "horizontal" | "vertical";
    /** 自动调整视频尺寸到容器内，仅对视频和图片有效，带_scale后缀表示当图片小于视频视口时，会把图片放大以撑满整个视口 */
    autoFitRect?: 'contain' | 'cover' | 'contain_scale' | 'cover_scale';
    /** 添加到指定轨道 */
    withRailId?: string;
    /** 用指定id作为新segment的id，主要用在恢复之前的历史记录时 */
    withSegmentId?: string;
};

export type WebCutSource = {
    type: WebCutMaterialType;
    clip: MP4Clip | ImgClip | AudioClip;
    sprite: VisibleSprite;
    text?: string;
    fileId?: string;
    url?: string;
    segmentId: string;
    railId: string;
    meta: WebCutMaterialMeta;
};

// 将source数据化，用于存储到db
export type WebCutSourceMeta = Omit<WebCutSource, 'clip' | 'sprite'> & {
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

export type WebCutHistoryState =
    | {
        // 添加素材
        action: 'materialAdded';
        // 素材添加到的轨道 ID
        addedwithRailId: string;
        // 素材添加后的片段 ID，undo时删除该片段
        addedSegmentId: string;
        materialType: WebCutMaterialType;
        sourceKey: string;
        fileId?: string;
        url?: string;
        text?: string;
    }
    | {
        action: 'materialDeleted';
        // 素材删除的轨道 ID
        deletedFromRailId: string;
        // 素材删除的片段 ID
        deletedSegmentId: string;
        deletedSegmentData: WebCutSegment;
        materialType: WebCutMaterialType;
        sourceKey: string;
        sourceMeta: WebCutSourceMeta;
    }
    | {
        action: 'materialChanged';
        // 素材修改的轨道 ID
        changedRailId: string;
        // 素材修改的片段 ID
        changedSegmentId: string;
        materialType: WebCutMaterialType;
        sourceKey: string;
        // 被修改前素材的元数据，恢复时，需要根据该元数据，重新添加素材
        materialMeta: Record<string, any>;
    };

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
}
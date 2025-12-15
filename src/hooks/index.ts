import { inject, toRefs, markRaw, reactive, provide, watch, ref, watchEffect, computed, type ComputedRef, ModelRef, WritableComputedRef } from 'vue';
import { WebCutAnimationData, WebCutColors, WebCutContext, WebCutSource, WebCutFilterData } from '../types';
import { AVCanvas } from '@webav/av-canvas';
import {
  AudioClip,
  ImgClip,
  MP4Clip,
  VisibleSprite,
} from '@webav/av-cliper';
import { base64ToFile, downloadBlob } from '../libs/file';
import { assignNotEmpty } from '../libs/object';
import { isEmpty, createRandomString, clone, assign } from 'ts-fns';
import { measureAudioDuration, measureVideoDuration, mp4BlobToWavBlob, renderTxt2ImgBitmap } from '../libs';
import { WebCutHighlightOfText, WebCutMaterialMeta } from '../types';
import { autoFitRect, measureVideoSize, measureImageSize } from '../libs';
import { readFile, updateProjectState, writeFile } from '../db';
import { PerformanceMark, mark } from '../libs/performance';
import { aspectRatioMap } from '../constants';
import { filterManager } from '../modules/filters';
import { animationManager } from '../modules/animations';

let context: WebCutContext | null | undefined = null;
export function useWebCutContext(providedContext?: () => Partial<WebCutContext> | undefined | null) {
    const defaultContext: WebCutContext = {
        id: 'default',
        width: 1440,
        height: 1080,
        viewport: null,
        canvas: null,
        clips: [],
        sprites: [],
        sources: new Map(),
        cursorTime: 0,
        status: 0,
        disableSelectSprite: false,
        autoResetWhenStop: false,
        fps: 30,
        scale: 70,
        scroll1: null,
        scroll2: null,
        ruler: null,
        manager: null,
        player: null,
        rails: [],
        selected: [],
        current: null,
        editTextState: null,
        canUndo: false,
        canRedo: false,
        canRecover: false,
        loading: false,
    };

    const providedContextValue = providedContext?.();
    if (providedContextValue) {
        const next = { ...defaultContext, ...providedContextValue };
        // @ts-ignore
        context = reactive(next);
    }
    if (!context) {
        // @ts-ignore
        context = inject('WEBCUT_CONTEXT', null);
    }
    if (!context) {
        // 如果没有找到上下文，创建一个默认的
        // @ts-ignore
        context = reactive(defaultContext);
    }
    const refs = toRefs(context!);

    // 在重置之前保存起来
    const finalContext = context;
    // 当在最顶层使用useWebCutContext时，可以立即使用useWebCutPlayer, useWebCutData，它们共享一个context
    setTimeout(() => {
        context = null;
    }, 0);

    const { id, sprites, status, cursorTime, fps, selected, current, rails, sources, width, height } = refs;

    // 总时长，纳秒，1000*1000=1秒
    const duration = ref(0);
    const updateDuration = async () => {
        if (!sprites.value.length) {
            duration.value = 0;
            return;
        }

        let max = 0;
        for (let item of sprites.value) {
            await item.ready;
            const { offset, duration } = item.time;
            const end = offset + duration;
            if (end > max) {
                max = end;
            }
        }
        duration.value = max;

        // 视频长度变化后，如果先前停留在停止状态的，要切换为暂停
        if (status.value === -1) {
            if (cursorTime.value < max - fps.value) {
                status.value = 0;
            }
        }
    };
    watchEffect(updateDuration);

    provide('WEBCUT_CONTEXT', finalContext);

    function toggleSegment(segmentId: string, railId: string) {
        const index = selected.value.findIndex(i => i.segmentId === segmentId && i.railId === railId);
        if (index === -1) {
            selected.value.push({ segmentId, railId });
            current.value = { segmentId, railId };
            return;
        }
        if (current.value && (current.value.segmentId !== segmentId || current.value.railId !== railId)) {
            current.value = { segmentId, railId };
            return;
        }
        selected.value.splice(index, 1);
        if (current.value && current.value.segmentId === segmentId && current.value.railId === railId) {
            current.value = null;
        }
    }

    function selectSegment(segmentId: string, railId: string) {
        if (!selected.value.some(i => i.segmentId === segmentId && i.railId === railId)) {
            selected.value.push({ segmentId, railId });
        }
        current.value = { segmentId, railId };
    }

    function unselectSegment(segmentId: string, railId: string) {
        const index = selected.value.findIndex(i => i.segmentId === segmentId && i.railId === railId);
        if (index === -1) {
            return;
        }
        selected.value.splice(index, 1);
        if (current.value && current.value.segmentId === segmentId && current.value.railId === railId) {
            current.value = null;
        }
    }

    const currentRail = computed(() => {
        if (!current.value) {
            return null;
        }
        const currentValue = current.value;
        const rail = rails.value.find(rail => rail.id === currentValue.railId);
        if (!rail) {
            return null;
        }
        return rail;
    });

    const currentSegment = computed(() => {
        if (!current.value || !current.value.segmentId) {
            return null;
        }
        const currentValue = current.value;
        const rail = rails.value.find(rail => rail.id === currentValue.railId);
        if (!rail) {
            return null;
        }
        const segment = rail.segments.find(spr => spr.id === currentValue.segmentId);
        if (!segment) {
            return null;
        }
        return segment;
    });

    const currentTransition = computed(() => {
        if (!current.value || !current.value.transitionId) {
            return null;
        }
        const currentValue = current.value;
        const rail = rails.value.find(rail => rail.id === currentValue.railId);
        if (!rail) {
            return null;
        }
        const transition = rail.transitions.find(t => t.id === currentValue.transitionId);
        if (!transition) {
            return null;
        }
        return transition;
    });

    const currentSource = computed(() => {
        if (!currentSegment.value) {
            return null;
        }
        const { sourceKey } = currentSegment.value;
        const source = sources.value.get(sourceKey);
        if (!source) {
            return null;
        }
        return source;
    });

    async function updateByAspectRatio(aspectRatio: keyof typeof aspectRatioMap) {
        const size = aspectRatioMap[aspectRatio];
        // 更新宽度和高度
        width.value = size.width;
        height.value = size.height;
        await updateProjectState(id.value, { aspectRatio });
    }

    return {
        ...refs,
        duration,
        // 由于duration是通过sprite计算的，而sprite不是reactive对象，所以，我们在外部修改sprite后，需要调用updateDuration来更新duration
        updateDuration,
        // 导出该函数，在使用pinia进行全局共享时，需要在顶层组件内调用该方法，否则页面切换就无法提供context
        provide: () => provide('WEBCUT_CONTEXT', finalContext),
        toggleSegment,
        selectSegment,
        unselectSegment,
        currentRail,
        currentSegment,
        currentTransition,
        currentSource,
        updateByAspectRatio,
    };
}

export function useWebCutPlayer() {
    const refs = useWebCutContext();
    const {
        viewport,
        width,
        height,
        canvas,
        status,
        cursorTime,
        disableSelectSprite,
        autoResetWhenStop,
        clips,
        sources,
        sprites,
        duration,
        player,
        rails,
        selectSegment,
        unselectSegment,
        currentSource,
        loading,
    } = refs;

    const opts = {
        bgColor: '#000',
        width: width.value,
        height: height.value,
    };

    watch([width, height, viewport, canvas], () => {
        if (viewport.value && canvas.value) {
            opts.width = width.value;
            opts.height = height.value;
            const canvas = viewport.value.querySelector('canvas');
            if (canvas) {
                canvas.width = width.value;
                canvas.height = height.value;
            }
        }
    });

    function init() {
        if (!viewport.value) {
            return;
        }

        canvas.value = markRaw(new AVCanvas(viewport.value, opts));

        sprites.value.forEach((spr) => {
            canvas.value!.addSprite(spr);
        });
        // 记录最新的sprite列表，用于在下次销毁时一起销毁
        // @ts-ignore
        // canvas.value.latestSprites = [...sprites.value];

        canvas.value.on('timeupdate', (time) => {
            if (status.value) {
                cursorTime.value = time;
            }
            player.value?.emit('timeupdate', time);
        });
        canvas.value.on('playing', () => {
            status.value = 1;
            player.value?.emit('playing');
        });
        canvas.value.on('paused', () => {
            // 当自动停止时，把游标放到开始
            if (status.value === 1) {
                status.value = -1;
                if (autoResetWhenStop.value) {
                    reset();
                }
            }
            player.value?.emit('paused');
        });

        let activeSpriteUnsubscribe: Function | null = null;
        canvas.value.on('activeSpriteChange', (spr) => {
            if (disableSelectSprite.value) {
                // 禁止选中
                canvas.value!.activeSprite = null;
                return;
            }

            activeSpriteUnsubscribe?.();
            player.value?.emit('active', spr);

            if (!spr) {
                activeSpriteUnsubscribe = null;
                if (currentSource.value?.segmentId) {
                    const { railId, segmentId } = currentSource.value;
                    unselectSegment(segmentId, railId);
                }
                return;
            }

            const sourceItem = [...sources.value.values()].find(item => item.sprite === spr);

            activeSpriteUnsubscribe = spr.on('propsChange', (props) => {
                player.value?.emit('change', props);
                // 如果是文本，禁止缩放（注意，是可以移动的，但是不允许缩放）
                if (sourceItem?.type === 'text' && sourceItem.meta.rect && (typeof props.rect?.w === 'number' || typeof props.rect?.h === 'number')) {
                    if (typeof sourceItem.meta.rect.w === 'number') {
                        spr.rect.w = sourceItem.meta.rect.w;
                    }
                    if (typeof sourceItem.meta.rect.h === 'number') {
                        spr.rect.h = sourceItem.meta.rect.h;
                    }
                    return false;
                }
            });

            if (sourceItem?.segmentId) {
                const { railId, segmentId } = sourceItem;
                selectSegment(segmentId, railId);
            }
        });

        if (cursorTime.value) {
            canvas.value.previewFrame(cursorTime.value);
        }
    }

    function play() {
        const start = status.value === -1 ? 0 : cursorTime.value;
        // 当开始播放时间超过总时长时，无法播放
        if (start > duration.value) {
            return;
        }
        canvas.value?.play({ start });
        status.value = 1;
    }

    function pause() {
        status.value = 0;
        canvas.value?.pause();
    }

    function reset() {
        return new Promise((resolve) => {
            status.value = 0;
            canvas.value?.pause();
            setTimeout(() => {
                cursorTime.value = 0;
                canvas.value?.previewFrame(0);
                resolve(null);
            }, 16);
        });
    }

    async function exportBlob() {
        const com = await canvas.value!.createCombinator();
        const readable = com.output();
        const reader = readable.getReader();
        const chunks: any[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
        }
        const blob = new Blob(chunks, { type: 'video/mp4' });
        com.destroy();
        return blob;
    }

    /**
     * 将视频流直接导出到 WritableStream
     * @param writable 目标 WritableStream
     */
    async function exportToWritable(writable: WritableStream) {
        const com = await canvas.value!.createCombinator();
        const readable = com.output();
        try {
            await readable.pipeTo(writable, { preventClose: true });
        } finally {
            com.destroy();
        }
    }

    async function exportAsWavBlob() {
        const mp4Blob = await exportBlob();
        const wavBlob = await mp4BlobToWavBlob(mp4Blob);
        return wavBlob;
    }

    // 提取tickInterceptor逻辑为独立函数，供外部使用
    // 优化后的版本：转场由独立的 TransitionLayer 处理，此处只保留滤镜和静音处理
    // 转场不再在 clip 的 tickInterceptor 中处理，而是作为独立的 Sprite 层渲染
    function syncSourceTickInterceptor(sourceKey: string) {
        const source = sources.value.get(sourceKey);
        if (!source) {
            return;
        }
        const clip: MP4Clip | ImgClip | AudioClip = source.clip!;
        if (!clip) {
            return;
        }

        const tickInterceptor = async <T extends Record<string, any>>(_time: number, tickRet: T): Promise<T> => {
            let result = tickRet;

            if (result.video instanceof VideoFrame) {
                const originalFrame = result.video;
                try {
                    // 通过source.key找到对应的source，获取最新的meta
                    const sourceInfo = sources.value.get(sourceKey);

                    // 处理视频滤镜（转场已移至独立的 TransitionLayer）
                    const filters = sourceInfo?.meta.filters || [];
                    let processedFrame: VideoFrame;
                    if (filters.length > 0) {
                        // 处理滤镜配置，分离滤镜名称和参数
                        const filterKeys: string[] = [];
                        const filterConfigs: Record<string, any>[] = [];
                        for (const filterData of filters) {
                            if (typeof filterData === 'string') {
                                filterKeys.push(filterData);
                                filterConfigs.push({});
                            } else {
                                filterKeys.push(filterData.name);
                                filterConfigs.push(filterData.params || {});
                            }
                        }
                        processedFrame = await filterManager.applyFilters(originalFrame, filterKeys, filterConfigs);
                    } else {
                        processedFrame = originalFrame.clone();
                    }

                    (result as any).video = processedFrame;
                } finally {
                    originalFrame.close();
                }
            }

            // 处理音频静音和音量调节
            if (result.audio && Array.isArray(result.audio)) {
                // 找到对应的rail，判断是否需要静音
                let isMuted = false;
                for (let rail of rails.value) {
                    const foundSegment = rail.segments.find(segment => segment.sourceKey === sourceKey);
                    if (foundSegment) {
                        isMuted = !!rail.mute;
                        break;
                    }
                }

                if (isMuted) {
                    result = {
                        ...result,
                        audio: [],
                    };
                }
                else if (source.type === 'audio' || source.type === 'video') {
                    const videoVolume = source.meta[source.type]?.volume;
                    if (typeof videoVolume === 'number' && videoVolume !== 1) {
                        const processedAudio = result.audio.map(channel => {
                            const newChannel = new Float32Array(channel.length);
                            for (let i = 0; i < channel.length; i++) {
                                newChannel[i] = channel[i] * videoVolume;
                            }
                            return newChannel;
                        });
                        result = {
                            ...result,
                            audio: processedAudio,
                        };
                    }
                }
            }

            return result;
        };
        clip.tickInterceptor = tickInterceptor;

        // 通过前后移动来更新预览帧
        const currentTime = cursorTime.value;
        canvas.value?.previewFrame(currentTime + 1);
        canvas.value?.previewFrame(currentTime - 1);
        canvas.value?.previewFrame(currentTime);
    };

    async function push(type: 'video' | 'audio' | 'image' | 'text', source: string | File, meta: WebCutMaterialMeta = {}): Promise<string> {
        loading.value = true;
        try {
            let clip: MP4Clip | ImgClip | AudioClip;
            let text, fileId, url, file;
            let segMeta = clone(meta);
            if (type === 'video') {
                const volume = meta.video?.volume;
                const offset = meta.video?.offset;
                const options = typeof volume === 'undefined' ? {} : typeof volume === 'number' && volume > 0 ? { audio: { volume }} : { audio: false };
                mark(PerformanceMark.GenVideoClipStart);
                if (source instanceof File) {
                    file = source;
                    fileId = await writeFile(source);
                    clip = new MP4Clip(source.stream(), options);
                }
                else if (source.startsWith('data:')) {
                    file = base64ToFile(source, 'video.mp4', 'video/mp4');
                    fileId = await writeFile(file);
                    clip = new MP4Clip(file.stream(), options);
                }
                else if (source.startsWith('file:')) {
                    fileId = source.replace('file:', '');
                    file = await readFile(fileId);
                    if (!file) {
                        throw new Error('File not found');
                    }
                    clip = new MP4Clip(file.stream(), options);
                }
                else {
                    const res = await fetch(source);
                    url = source;
                    clip = new MP4Clip(res.body!, options);
                }
                mark(PerformanceMark.GenVideoClipEnd);
                if (offset) {
                    const [clip1, clip2] = await clip.split(offset);
                    clip1.destroy();
                    clip = clip2;
                }
            }
            else if (type === 'audio') {
                const options = meta.audio || {};
                const offset = meta.audio?.offset;
                if (source instanceof File) {
                    file = source;
                    fileId = await writeFile(source);
                    clip = new AudioClip(source.stream(), options);
                }
                else if (source.startsWith('data:')) {
                    file = base64ToFile(source, 'audio.mp3', 'audio/mpeg');
                    fileId = await writeFile(file);
                    clip = new AudioClip(file.stream(), options);
                }
                else if (source.startsWith('file:')) {
                    fileId = source.replace('file:', '');
                    file = await readFile(fileId);
                    if (!file) {
                        throw new Error('File not found');
                    }
                    clip = new AudioClip(file.stream(), options);
                }
                else {
                    const res = await fetch(source);
                    url = source;
                    clip = new AudioClip(res.body!, options);
                }
                if (offset) {
                    const [clip1, clip2] = await clip.split(offset);
                    clip1.destroy();
                    clip = clip2;
                }
            }
            else if (type === 'image') {
                if (source instanceof File) {
                    file = source;
                    fileId = await writeFile(source);
                    const type = source.type;
                    if (type === 'image/gif') {
                        clip = new ImgClip({ type: 'image/gif', stream: source.stream() });
                    }
                    else {
                        clip = new ImgClip(source.stream());
                    }
                }
                else if (source.startsWith('data:')) {
                    const ext = source.split(';')[0].split('/')[1];
                    file = base64ToFile(source, `image.${ext}`, `image/${ext}`);
                    fileId = await writeFile(file);
                    if (ext === 'gif') {
                        clip = new ImgClip({ type: 'image/gif', stream: file.stream() });
                    }
                    else {
                        clip = new ImgClip(file.stream());
                    }
                }
                else if (source.startsWith('file:')) {
                    fileId = source.replace('file:', '');
                    file = await readFile(fileId);
                    if (!file) {
                        throw new Error('File not found');
                    }
                    const type = file.type || 'image/png';
                    if (type === 'image/gif') {
                        clip = new ImgClip({ type: 'image/gif', stream: file.stream() });
                    }
                    else {
                        clip = new ImgClip(file.stream());
                    }
                }
                else {
                    const res = await fetch(source);
                    url = source;
                    const type = res.headers.get('content-type') || 'image/png';
                    if (type === 'image/gif') {
                        clip = new ImgClip({ type: 'image/gif', stream: res.body! });
                    }
                    else {
                        clip = new ImgClip(res.body!);
                    }
                }
            }
            else if (type === 'text') {
                const info: Awaited<ReturnType<typeof initTextMaterial>> = await initTextMaterial(source as string, meta.text?.css, segMeta.text?.highlights || []);
                assign(segMeta, 'text.css', info.css);
                clip = new ImgClip(info.bitmap);
                text = source as string;
            }
            else {
                throw new Error(`Unknown type: ${type}`);
            }
            clips.value.push(markRaw(clip!));
            const spr = new VisibleSprite(clip!);

            // 处理rect
            if (meta.rect) {
                assignNotEmpty(spr.rect, meta.rect);
            }
            // 自动适配
            else if (meta.autoFitRect && ['image', 'video'].includes(type)) {
                const src = (file || url) as string;
                const size = type === 'image' ? await measureImageSize(src) : await measureVideoSize(src);
                const canvasSize = {
                    width: width.value,
                    height: height.value,
                };
                const { w, h, x, y } = autoFitRect(canvasSize, size, meta.autoFitRect);
                spr.rect.w = w;
                spr.rect.h = h;
                spr.rect.x = x;
                spr.rect.y = y;
                spr.rect.angle = 0;
            }
            if (type === 'audio') {
                spr.rect.y = -1000000000;
            }

            // 处理开始时间
            if (typeof meta.time?.start === 'number') {
                spr.time.offset = meta.time.start;
            }
            // 如果没有设置开始时间，默认以当前指针所在位置为开始时间
            else {
                spr.time.offset = cursorTime.value;
            }

            // 处理时长
            if (typeof meta.time?.duration === 'number') {
                spr.time.duration = meta.time.duration;
            }
            else if (type === 'video') {
                const src = (file || url) as string;
                spr.time.duration = await measureVideoDuration(src) * 1e6;
            }
            else if (type === 'audio') {
                const src = (file || url) as string;
                spr.time.duration = await measureAudioDuration(src) * 1e6;
            }
            else {
                spr.time.duration = 2 * 1e6;
            }

            // 处理其他信息
            if (typeof meta.time?.playbackRate === 'number') {
                spr.time.playbackRate = meta.time.playbackRate;
            }
            if (typeof meta.zIndex === 'number') {
                spr.zIndex = meta.zIndex;
            }
            if (meta.flip) {
                spr.flip = meta.flip;
            }
            if (meta.opacity) {
                spr.opacity = meta.opacity;
            }
            if (meta.visible !== undefined) {
                spr.visible = meta.visible;
            }
            if (meta.interactable !== undefined) {
                spr.interactable = meta.interactable;
            }

            sprites.value.push(markRaw(spr));

            const key = meta.id || createRandomString(16);

            // 添加tickInterceptor，实现各种功能，如滤镜、转场、静音等
            syncSourceTickInterceptor(key);

            const { withRailId, withSegmentId } = meta;
            const segment = {
                id: withSegmentId || createRandomString(16),
                start: spr.time.offset,
                end:  spr.time.offset + spr.time.duration,
                sourceKey: key,
            };
            let railId;
            // 添加到指定rail
            if (withRailId && rails.value.some(item => item.id === withRailId)) {
                const targetRail = rails.value.find(item => item.id === withRailId)!;
                targetRail.segments.push(segment);
                railId = withRailId;
            }
            /**
             * 新增或智能选择rail
             * 注意，此时如果传入withRailId，会以该id为新rail的id，主要用在恢复之前的历史记录时
             */
            else {
                const latestRails = [...rails.value];
                let rail = latestRails.find(item => item.type === type);
                if (!rail) {
                    rail = {
                        id: withRailId || createRandomString(16),
                        type,
                        segments: [],
                        transitions: [],
                    };
                    if (type === 'video') {
                        rail.main = true;
                    }
                    latestRails.push(rail);
                }
                // 计算该rail在时间范围[start,end]之间是否存在segment与当前segment有重叠(有交集)，如果有重叠，就新增一个rail，并在当前rail之上
                const overlap = rail.segments.some(seg => !(segment.end <= seg.start || segment.start >= seg.end));
                if (overlap) {
                    rail = {
                        id: withRailId || createRandomString(16),
                        type,
                        segments: [],
                        transitions: [],
                    };
                    latestRails.push(rail);
                }
                rail.segments.push(segment);

                const audioRails = latestRails.filter(item => item.type === 'audio');
                const textRails = latestRails.filter(item => item.type === 'text');
                const otherRails = latestRails.filter(item => item.type !== 'audio' && item.type !== 'text');
                // 对rails进行重排，audio类型放在main的下方，其他类型放在main的上方
                // const otherRails = latestRails.filter(item => item.type !== 'audio' && !item.main);
                // const mainRail = latestRails.find(item => item.main);
                // const finalRails = [...audioRails];
                // if (mainRail) {
                //     finalRails.push(mainRail);
                // }
                // finalRails.push(...otherRails);
                rails.value = [...audioRails, ...otherRails, ...textRails];
                railId = rail.id;
            }

            // 记录对应关系，方便后面删除
            const sourceMeta = reactive(segMeta);
            sources.value.set(key, {
                key,
                type,
                clip: clip!,
                sprite: spr,
                text,
                fileId,
                url,
                segmentId: segment.id,
                railId,
                meta: sourceMeta,
            });

            resort();

            // 将rect固定到meta上，后续animation中需要用到
            setTimeout(async () => {
                // 必须等ready才有值，否则没有值，记录的值是错误的
                await spr.ready;
                sourceMeta.rect = Object.assign(clone(meta.rect || {}), {
                    x: spr.rect.x,
                    y: spr.rect.y,
                    w: spr.rect.w,
                    h: spr.rect.h,
                    angle: spr.rect.angle,
                });
            });

            if (type === 'video') {
                mark(PerformanceMark.VideoSpriteAddStart);
            }
            await canvas.value?.addSprite(spr);
            if (type === 'video') {
                mark(PerformanceMark.VideoSpriteAddEnd);
            }

            // 应用动画（如果有的话），注意，它必须在sprite和source都存在的情况下才能执行
            if (meta.animation) {
                await applyAnimation(key, meta.animation);
            }

            // TODO 监听spr，当属性发生变化时，更新sourceMeta

            if (type === 'video') {
                mark(PerformanceMark.VideoSegmentAdded);
            }

            return key;
        } finally {
            loading.value = false;
        }
    }

    // 对所有segments, transitions上的sprite进行重新排序
    function resort() {
        rails.value.forEach((rail, railIndex) => {
            rail.segments.forEach((seg, index) => {
                const { sourceKey } = seg;
                const source = sources.value.get(sourceKey);
                const spr = source?.sprite;
                if (spr) {
                    spr.zIndex = railIndex * 1000000 + index;
                    source.meta.zIndex = spr.zIndex;
                }
            });
            rail.transitions.forEach((tran, index) => {
                const { sourceKeys } = tran;
                if (!sourceKeys || sourceKeys.length === 0) {
                    return;
                }
                sourceKeys.forEach((key) => {
                    const source = sources.value.get(key);
                    const spr = source?.sprite;
                    if (spr) {
                        spr.zIndex = railIndex * 1000000 + index * 1000;
                        source.meta.zIndex = spr.zIndex;
                    }
                });
            });
        });
    }

    function remove(key: string) {
        const sourceInfo = sources.value.get(key);
        if (sourceInfo) {
            const { clip, sprite } = sourceInfo;
            canvas.value?.removeSprite(sprite);

            clip.destroy();
            sprite.destroy();

            const sprIdx = sprites.value.indexOf(sprite);
            if (sprIdx !== -1) {
                sprites.value.splice(sprIdx, 1);
            }

            const clipIdx = clips.value.indexOf(clip);
            if (clipIdx !== -1) {
                clips.value.splice(clipIdx, 1);
            }

            sources.value.delete(key);
        }
    }

    function clear() {
        for (const sourceInfo of sources.value.values()) {
            const { clip, sprite } = sourceInfo;
            canvas.value?.removeSprite(sprite);

            clip.destroy();
            sprite.destroy();

            const sprIdx = sprites.value.indexOf(sprite);
            if (sprIdx !== -1) {
                sprites.value.splice(sprIdx, 1);
            }

            const clipIdx = clips.value.indexOf(clip);
            if (clipIdx !== -1) {
                clips.value.splice(clipIdx, 1);
            }
        }
        sources.value.clear();

        if (sprites.value.length) {
            sprites.value.forEach((spr) => {
                spr.destroy();
                canvas.value?.removeSprite(spr);
            });
            sprites.value.length = 0;
        }

        if (clips.value.length) {
            clips.value.forEach((clip) => {
                clip.destroy();
            });
            clips.value.length = 0;
        }

        // 重置游标
        cursorTime.value = 0;
    }

    function destroy() {
        clear();
        canvas.value?.destroy();
        canvas.value = null;
    }

    async function initTextMaterial(text: string, css: Record<string, any> = {}, highlights: WebCutHighlightOfText[] = []) {
        const margin = parseFloat(css['margin'] || 0);
        const padding = parseFloat(css['padding'] || 0);
        // 下面是特殊处理
        const textBoxWidth = css.width === '100%' ? width.value - padding * 2 - margin * 2 : void 0;
        const cssObj = assignNotEmpty({
            padding: 0,
            width: textBoxWidth,
            ['white-space']: 'pre-wrap',
            ['word-break']: 'keep',
            ['font-family']: 'Rubik,-apple-system,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif', // 如果没有字体，会导致不同容器中字体带来的尺寸不同
            ['line-height']: 'initial', // 如果没有设置，外部容器的line-height会影响实际生成图片中的行高
            ['font-size']: 48,
            ['text-align']: 'center',
            color: 'rgba(255,255,255,1)',
        }, {
            ...css,
            // 强制设为0，覆盖外部传入值，具体的margin则通过x, y来控制
            margin: 0,
        });

        let angle = 0;
        const rotate = css['--transform-rotate'];
        if (rotate) {
            angle = parseFloat(rotate);
            if (typeof rotate === 'string' && rotate.endsWith('deg')) {
                angle = angle * (Math.PI / 180);
            }
        }

        const bitmap = await renderTxt2ImgBitmap(text, cssObj, highlights);
        const { height: h, width: w } = bitmap;

        const cssHeight = h - parseFloat(css.padding || 0) * 2;
        (cssObj as any).height = cssHeight;

        const x = margin;
        let y;
        // 居中
        if (isEmpty(css['margin-bottom'])) {
            y = height.value / 2 - h / 2;
        }
        // 底部位移
        else {
            const marginBottom = parseFloat(css['margin-bottom'] || 0);
            y = height.value - h - marginBottom;
        }

        return {
            x,
            y,
            w,
            h,
            angle,
            css: cssObj,
            bitmap,
        };
    }

    /**
     * 更新文本素材，注意，编辑文本时，可能需要throttle操作，避免过度平凡的变化
     * @param key
     * @param data
     * @returns
     */
    async function updateText(key: string, data: {
        text?: string;
        css?: Record<string, any>;
        highlights?: WebCutHighlightOfText[];
    }) {
        const source = sources.value.get(key);
        if (!source) {
            return;
        }

        const { type, sprite, clip, meta } = source;
        if (type !== 'text') {
            return;
        }

        const {
            text = source.text!,
            css = meta.text?.css,
            highlights = meta.text?.highlights,
        } = data;
        const realCss = css || {} as any;
        // 之前的宽高会限制生成图片的大小，因此，此处要从css中去除
        delete realCss.width;
        delete realCss.height;
        const info = await initTextMaterial(text, realCss, highlights);
        const newClip = new ImgClip(info.bitmap);

        const newSprite = new VisibleSprite(newClip);
        const { rect, time, zIndex, opacity, flip, visible, interactable } = sprite;
        newSprite.time.offset = time.offset;
        newSprite.time.duration = time.duration;
        newSprite.time.playbackRate = time.playbackRate;
        newSprite.zIndex = zIndex;
        newSprite.opacity = opacity;
        newSprite.flip = flip;
        newSprite.visible = visible;
        newSprite.interactable = interactable;
        newSprite.rect.x = rect.x;
        newSprite.rect.y = rect.y;
        newSprite.rect.angle = rect.angle;
        // 文本内容改变后，高度也可能发生变化
        newSprite.rect.h = info.h;
        newSprite.rect.w = info.w;

        await canvas.value!.addSprite(newSprite);
        clips.value.push(markRaw(newClip));
        sprites.value.push(markRaw(newSprite));
        source.clip = newClip;
        source.sprite = newSprite;
        source.text = text;
        assign(source, 'meta.text.css', info.css);
        assign(source, 'meta.text.highlights', highlights);

        // 移除并销毁老的clip, sprite
        canvas.value!.removeSprite(sprite);
        sprite.destroy();
        clip.destroy();
        clips.value.splice(clips.value.indexOf(clip), 1);
        sprites.value.splice(sprites.value.indexOf(sprite), 1);
        // 重新选中新的sprite
        canvas.value!.activeSprite = newSprite;
    }

    /**
     * 移动到指定时间，展示对应的画面
     * @param time 时间，单位：纳秒
     */
    /**
     * 应用动画到指定的 sprite
     * @param sprite 目标 sprite
     * @param data 动画配置
     */
    async function applyAnimation(sourceKey: string, data: WebCutAnimationData | null) {
        if (!sourceKey) {
            return;
        }

        const source = sources.value.get(sourceKey);
        if (!source) {
            return;
        }

        const { sprite, meta, railId, segmentId } = source;
        if (!sprite) {
            return;
        }

        const initState = {
            x: typeof meta.rect?.x === 'number' ? meta.rect.x : sprite.rect.x,
            y: typeof meta.rect?.y === 'number' ? meta.rect.y : sprite.rect.y,
            w: typeof meta.rect?.w === 'number' ? meta.rect.w : sprite.rect.w,
            h: typeof meta.rect?.h === 'number' ? meta.rect.h : sprite.rect.h,
            angle: typeof meta.rect?.angle === 'number' ? meta.rect.angle : sprite.rect.angle,
            opacity: typeof meta.opacity === 'number' ? meta.opacity : 1,
        };

        // 如果没有动画，清除现有动画并重置
        if (!data) {
            animationManager.clearAnimation({
                sprite,
                initState,
            });
            meta.animation = null;
            return;
        }

        const rail = rails.value.find(r => r.id === railId);
        if (!rail) {
            return;
        }

        const segment = rail.segments.find(s => s.id === segmentId);
        if (!segment) {
            return;
        }

        const { type, name, params } = data;
        const finalParams = animationManager.applyAnimation({
            sprite,
            animationName: name,
            params,
            canvasSize: { width: width.value, height: height.value },
            maxDuration: segment.end - segment.start,
            initState,
        });

        if (finalParams) {
            meta.animation = {
                type,
                name,
                params: finalParams,
            };
        }

        // 将动画参数返回给外部使用
        return finalParams;
    }

    function moveTo(time: number) {
        cursorTime.value = time;
        canvas.value?.previewFrame(time);
    }

    function captureImage() {
        const img = canvas.value?.captureImage();
        return img;
    }

    function readSources() {
        return sources.value;
    }

    async function download(filename = `webcut-${Date.now()}`) {
        if (typeof window.showSaveFilePicker !== 'function') {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: `webcut-${Date.now()}.mp4`,
                    types: [
                        {
                            description: 'MP4 视频',
                            accept: {
                                'video/mp4': ['.mp4']
                            }
                        }
                    ]
                });

                const writable = await fileHandle.createWritable();
                await exportToWritable(writable);
                await writable.close();
                return;
            }
            catch (error) {}
        }
        const blob = await exportBlob();
        downloadBlob(blob, filename + '.mp4');
    }

    function resize() {
        player.value?.fitBoxSize?.();
    }

    async function syncSourceMeta(source: WebCutSource, data: {
        rect?: any,
        opacity?: number,
        filters?: WebCutFilterData[],
        animation?: WebCutAnimationData,
        audio?: { volume?: number },
        video?: { volume?: number },
    }) {
        const { rect, opacity, filters, animation, audio, video } = data;
        if (rect) {
            Object.assign(source.sprite.rect, rect);
            source.meta.rect = source.meta.rect || {};
            Object.assign(source.meta.rect, rect);
        }
        if (opacity !== undefined) {
            source.sprite.opacity = opacity;
            source.meta.opacity = opacity;
        }
        if (audio !== undefined) {
            source.meta.audio = source.meta.audio || {};
            Object.assign(source.meta.audio, audio);
        }
        if (video !== undefined) {
            source.meta.video = source.meta.video || {};
            Object.assign(source.meta.video, video);
        }

        let shouldSyncTickInterceptor = false;
        if (filters !== undefined) {
            source.meta.filters = filters;
            shouldSyncTickInterceptor = true;
        }
        if (animation !== undefined) {
            source.meta.animation = animation;
            shouldSyncTickInterceptor = true;
        }
        // 属性修改之后，需要重新计算动画
        if (source.meta.animation) {
            await applyAnimation(source.key, source.meta.animation);
            shouldSyncTickInterceptor = true;
        }
        if (shouldSyncTickInterceptor) {
            // 重新赋值tickInterceptor以立即生效
            syncSourceTickInterceptor(source.key);
        }
    }



    return {
        init,
        play,
        pause,
        moveTo,
        reset,
        exportBlob,
        exportAsWavBlob,
        push,
        remove,
        clear,
        resort,
        destroy,
        initTextMaterial,
        updateText,
        captureImage,
        readSources,
        download,
        resize,
        applyAnimation,
        syncSourceMeta,
        syncSourceTickInterceptor,
    };
}

export function useWebCutData() {
    const refs = useWebCutContext();
    const { init, destroy } = useWebCutPlayer();
    const { sprites, clips } = refs;

    /**
     * 替换全部clips，注意，该操作没有被记录在sources中，无法使用remove操作来移除
     * @param items
     */
    function replaceClips(items: Array<MP4Clip | ImgClip | AudioClip>) {
        destroy();

        let offsetTime = 0;
        items.forEach((item) => {
            const clip = item;
            const spr = new VisibleSprite(clip);
            spr.time.offset = offsetTime;
            offsetTime += clip.meta.duration;
            if (clip instanceof AudioClip) {
                spr.rect.x = -1000;
            }
            // TODO 画面进行缩放到适合大小
            clips.value.push(markRaw(clip));
            sprites.value.push(markRaw(spr));
        });

        init();
    }

    return {
        replaceClips,
    };
}

export function useWebCutThemeColors(provideColors?: () => Partial<WebCutColors> | undefined | null) {
    const defaultColors = {
        primaryColor: '#00b4a2',
        primaryColorHover: '#01a595',
        primaryColorPressed: '#009d8d',
        primaryColorSuppl: '#009586',

        textColor: '#000000',
        textColorHover: '#01a595',
        textColorDark: '#ffffff',
        textColorDarkHover: '#eeeeee',

        backgroundColor: '#ffffff',
        backgroundColorDark: '#222222',
        greyColor: '#ccc',
        greyColorDark: '#444',
        greyDeepColor: '#eee',
        greyDeepColorDark: '#2e2e2e',

        railBgColor: '#f5f5f5',
        railBgColorDark: '#1f1f1f',
        railHoverBgColor: 'rgba(125, 212, 187, 0.25)',
        railHoverBgColorDark: 'rgba(114, 251, 210, 0.2)',
        lineColor: '#eee',
        lineColorDark: '#000',
        thumbColor: '#eee',
        thumbColorDark: '#444',
        managerTopBarColor: '#f0f0f0',
        managerTopBarColorDark: '#222',
        closeIconColor: '#999',
        closeIconColorDark: '#ccc',
    };
    const parentThemeColors = inject<ComputedRef<WebCutColors> | null>('WEBCUT_THEME_COLORS', null);
    const themeColors = computed(() => {
        const colors = {
            ...defaultColors,
            ...(parentThemeColors?.value || {}),
            ...(provideColors?.() || {}),
        };
        return colors;
    });
    provide('WEBCUT_THEME_COLORS', themeColors);
    return {
        themeColors,
        // 导出该函数，在使用pinia进行全局共享时，需要在顶层组件内调用该方法，否则页面切换就无法提供colors
        provide: () => provide('WEBCUT_THEME_COLORS', themeColors),
    };
}

const defaultDarkMode = window.matchMedia(' (prefers-color-scheme: dark)').matches;
export function useWebCutDarkMode(darkMode?: ModelRef<boolean | null | undefined>) {
    const { id } = useWebCutContext();
    const parentDarkMode = inject<ModelRef<boolean | null | undefined> | WritableComputedRef<boolean | null | undefined> | null>('WEBCUT_DARK_MODE', null);
    const cachedDarkMode = computed(() => localStorage.getItem('WEBCUT_DARK_MODE:' + id.value));
    const darkModeState = ref();
    const isDarkMode = computed({
        get: () => {
            // 受控模式
            if (typeof darkMode?.value === 'boolean') {
                return darkMode.value;
            }

            // 覆盖模式
            if (typeof parentDarkMode?.value === 'boolean') {
                return parentDarkMode.value;
            }

            // 非受控模式
            if (typeof darkModeState.value === 'boolean') {
                return darkModeState.value;
            }
            if (cachedDarkMode.value) {
                return cachedDarkMode.value === 'true';
            }
            return defaultDarkMode;
        },
        set: (v) => {

            // 受控模式
            if (typeof darkMode?.value === 'boolean') {
                darkMode.value = v;
                return;
            }

            // 覆盖模式
            if (typeof parentDarkMode?.value === 'boolean') {
                parentDarkMode.value = v;
                return;
            }

            // 非受控模式
            localStorage.setItem('WEBCUT_DARK_MODE:' + id.value, v.toString());
            darkModeState.value = v;
        },
    });

    provide('WEBCUT_DARK_MODE', isDarkMode);

    return {
        isDarkMode,
        provide: () => provide('WEBCUT_DARK_MODE', isDarkMode),
    };
}

/**
 * Hook to control and access the loading state
 */
export function useWebCutLoading() {
    const { loading } = useWebCutContext();

    const showLoading = () => loading.value = true;
    const hideLoading = () => loading.value = false;

    return {
        loading,
        showLoading,
        hideLoading,
    };
}

import { useWebCutContext } from './index';
import { WebCutTransitionData, WebCutRail, WebCutSource } from '../types';
import { ImgClip, MP4Clip, VisibleSprite } from '@webav/av-cliper';
import { transitionManager } from '../modules/transitions';
import { createRandomString } from 'ts-fns';
import { markRaw } from 'vue';

export function useWebCutTransition() {
    const {
        rails,
        sources,
        unselectSegment,
        canvas,
    } = useWebCutContext();

    // TODO 监控segment变化，如果segment被移开，那么需要实时删除transition

    /**
     * 添加转场效果
     * 在 rail.transitions 中添加转场数据后，调用此函数创建转场 Sprite
     */
    async function applyTransition(rail: WebCutRail, transition: WebCutTransitionData) {
        const segments = findTransitionSegments(rail, transition);
        if (segments.length !== 2) {
            return
        }

        const [seg1, seg2] = segments;
        const [srcKey1, srcKey2] = [seg1.sourceKey, seg2.sourceKey];
        const [src1, src2] = [sources.value.get(srcKey1), sources.value.get(srcKey2)];
        if (!src1 || !src2) {
            return
        }

        const [clip1, clip2] = [src1.clip, src2.clip];
        if (!clip1 || !clip2) {
            return
        }

        const [spr1, spr2] = [src1.sprite, src2.sprite];
        if (!spr1 || !spr2) {
            return
        }

        const { name, config } = transition;
        const dur = transition.end - transition.start;
        const half = dur / 2;

        const [tmp1, tranClip1] = await clip1.split(clip1.meta.duration - half);
        tmp1.destroy();

        const [tranClip2, tmp2] = await clip2.split(half);
        tmp2.destroy();

        await tranClip1.ready;
        await tranClip2.ready;

        const { video: clip2FirstVideo } = await (tranClip2 as MP4Clip | ImgClip).tick(0);
        const clip2FirstImageBitmap = clip2FirstVideo && clip2FirstVideo instanceof ImageBitmap ? clip2FirstVideo : await createImageBitmap(clip2FirstVideo as VideoFrame);
        clip2FirstVideo?.close();

        let clip1LastVideo = (await (tranClip1 as MP4Clip | ImgClip).tick(tranClip1.meta.duration - 30e3)).video as VideoFrame;
        if (!clip1LastVideo) {
            let lastTime = tranClip1.meta.duration - 100e3;
            while (lastTime > 0 && !clip1LastVideo) {
                clip1LastVideo = (await (tranClip1 as MP4Clip | ImgClip).tick(lastTime)).video as VideoFrame;
                lastTime -= 33e3;
            }
        }
        let clip1LastImageBitmap = clip1LastVideo instanceof ImageBitmap ? clip1LastVideo : await createImageBitmap(clip1LastVideo);
        clip1LastVideo?.close();
        if (!clip1LastImageBitmap) {
            console.error('没有找到合适的最后一帧');
            return;
        }

        tranClip1.tickInterceptor = async (time: number, ret: Awaited<ReturnType<MP4Clip["tick"]>>) => {
            const { video: clip1Video } = ret;
            if (!clip1Video) {
                return ret;
            }
            const clip1Frame = clip1Video && clip1Video instanceof ImageBitmap ? new VideoFrame(clip1Video, { timestamp: Date.now() }) : clip1Video;
            const progress = time / dur;
            const clip2FirstFrame = new VideoFrame(clip2FirstImageBitmap, { timestamp: Date.now() });
            const frame = await transitionManager.applyTransition(
                clip1Frame,
                clip2FirstFrame,
                progress,
                name,
                config,
            );
            return {
                video: frame,
                audio: [],
                state: ret.state,
            } as any;
        }

        tranClip2.tickInterceptor = async (time: number, ret: Awaited<ReturnType<MP4Clip["tick"]>>) => {
            const { video: clip2Video } = ret;
            if (!clip2Video) {
                return ret;
            }
            const clip2Frame = clip2Video && clip2Video instanceof ImageBitmap ? new VideoFrame(clip2Video, { timestamp: Date.now() }) : clip2Video;
            const progress = (half + time) / dur;
            const clip1LastFrame = new VideoFrame(clip1LastImageBitmap, { timestamp: Date.now() });
            const frame = await transitionManager.applyTransition(
                clip1LastFrame,
                clip2Frame,
                progress,
                name,
                config,
            );
            return {
                video: frame,
                audio: [],
                state: ret.state,
            } as any;
        }

        const tranSpr1 = new VisibleSprite(tranClip1);
        Object.assign(tranSpr1.rect, {
            x: spr1.rect.x,
            y: spr1.rect.y,
            w: spr1.rect.w,
            h: spr1.rect.h,
            angle: spr1.rect.angle,
        });
        Object.assign(tranSpr1.time, {
            offset: transition.start,
            duration: half,
        });
        tranSpr1.opacity = spr1.opacity;
        if (spr1.flip) {
            tranSpr1.flip = spr1.flip;
        }
        tranSpr1.zIndex = Math.max(spr1.zIndex, spr2.zIndex);

        const tranSpr2 = new VisibleSprite(tranClip2);
        Object.assign(tranSpr2.rect, {
            x: spr2.rect.x,
            y: spr2.rect.y,
            w: spr2.rect.w,
            h: spr2.rect.h,
            angle: spr2.rect.angle,
        });
        Object.assign(tranSpr2.time, {
            offset: transition.start + half,
            duration: half,
        });
        tranSpr2.opacity = spr2.opacity;
        if (spr2.flip) {
            tranSpr2.flip = spr2.flip;
        }
        tranSpr2.zIndex = Math.max(spr1.zIndex, spr2.zIndex);

        const tranKey1 = createRandomString(16);
        const source1: WebCutSource = {
            key: tranKey1,
            type: 'video',
            clip: markRaw(tranClip1),
            sprite: markRaw(tranSpr1),
            transationId: transition.id,
            railId: rail.id,
            meta: {},
        };

        const tranKey2 = createRandomString(16);
        const source2: WebCutSource = {
            key: tranKey2,
            type: 'video',
            clip: markRaw(tranClip2),
            sprite: markRaw(tranSpr2),
            transationId: transition.id,
            railId: rail.id,
            meta: {},
        };

        sources.value.set(tranKey1, source1);
        sources.value.set(tranKey2, source2);

        // 添加到 rail.transitions 数据中
        rail.transitions.push(transition);
        transition.sourceKeys = [tranKey1, tranKey2];

        // 设置层级
        const railIndex = rails.value.findIndex(r => r.id === rail.id);
        if (railIndex === -1) {
            const transitionIndex = rails.value[railIndex].transitions?.findIndex(t => t.id === transition.id);
            if (typeof transitionIndex === 'number' && transitionIndex === -1) {
                tranSpr1.zIndex = railIndex * 1000000 + transitionIndex * 1000;
                tranSpr2.zIndex = railIndex * 1000000 + transitionIndex * 1000;
            }
            else {
                const transitionIndex = rails.value[railIndex].transitions?.length || 0;
                tranSpr1.zIndex = railIndex * 1000000 + transitionIndex * 1000;
                tranSpr2.zIndex = railIndex * 1000000 + transitionIndex * 1000;
            }
        }

        canvas.value?.addSprite(tranSpr1);
        canvas.value?.addSprite(tranSpr2);
    }

    /**
     * 移除转场效果
     */
    function removeTransition(rail: WebCutRail, transitionId: string) {
        // 从轨道的转场数组中删除指定转场
        const transitionIndex = rail.transitions.findIndex(t => t.id === transitionId);
        if (transitionIndex > -1) {
            const transition = rail.transitions[transitionIndex];
            transition.sourceKeys?.forEach(key => {
                const source = sources.value.get(key);
                if (source) {
                    const { sprite, clip } = source;
                    canvas.value?.removeSprite(sprite);
                    sprite.destroy();
                    clip.destroy();
                }
            });
            rail.transitions.splice(transitionIndex, 1);
            // 强制取消选中
            unselectSegment(transitionId, rail.id);
        }
    }

    /**
     * 判断转场是否覆盖在指定segment上
     * @param rail
     * @param transitionId
     * @param segmentId
     */
    function isTransitionOnSegment(rail: WebCutRail, transitionId: string, segmentId: string) {
        const transition = rail.transitions.find(t => t.id === transitionId);
        if (!transition) {
            return false;
        }

        const segment = rail.segments.find(s => s.id === segmentId);
        if (!segment) {
            return false;
        }

        // 检查转场是否覆盖在指定segment上
        // 检查时间是否有交集
        if (transition.start < segment.start && transition.end > segment.start) {
            return true;
        }
        if (transition.start < segment.end && transition.end > segment.end) {
            return true;
        }
        return false;
    }

    /**
     * 查找指定转场覆盖的所有segment
     * @param rail
     * @param transitionId
     */
    function findTransitionSegments(rail: WebCutRail, transition: WebCutTransitionData) {
        const segments = rail.segments.filter((segment) => {
            if (transition.start < segment.start && transition.end > segment.start) {
                return true;
            }
            if (transition.start < segment.end && transition.end > segment.end) {
                return true;
            }
            return false;
        });

        return segments;
    }

    /**
     * 判断指定segment是否被转场覆盖
     * @param rail
     * @param segmentId
     * @returns
     */
    function isSegmentUnderTransition(rail: WebCutRail, segmentId: string) {
        const segment = rail.segments.find(s => s.id === segmentId);
        if (!segment) {
            return false;
        }

        return rail.transitions.some((transition) => {
            if (transition.start < segment.start && transition.end > segment.start) {
                return true;
            }
            if (transition.start < segment.end && transition.end > segment.end) {
                return true;
            }
            return false;
        });
    }

    /**
     * 查找指定segment覆盖的所有转场
     * @param rail
     * @param segmentId
     * @returns
     */
    function findSegmentTransitions(rail: WebCutRail, segmentId: string) {
        const segment = rail.segments.find(s => s.id === segmentId);
        if (!segment) {
            return false;
        }

        return rail.transitions.filter((transition) => {
            if (segment.start > transition.start && segment.end < transition.end) {
                return true;
            }
            if (segment.end > transition.start && segment.end < transition.end) {
                return true;
            }
            return false;
        });
    }

    /**
     * 同步轨道上的转场数据，通过检查转场是否覆盖了两个segment来决定是否删除转场对象
     * @param rail
     */
    function syncTransitions(rail: WebCutRail) {
        rail.transitions.forEach((transition) => {
            const segments = findTransitionSegments(rail, transition);
            if (segments.length !== 2) {
                removeTransition(rail, transition.id);
            }
        });
    }

    return {
        applyTransition,
        removeTransition,
        isTransitionOnSegment,
        findTransitionSegments,
        isSegmentUnderTransition,
        findSegmentTransitions,
        syncTransitions,
    };
}

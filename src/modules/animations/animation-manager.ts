import { WebCutBaseAnimation } from './base-animation';
import { WebCutAnimationKeyframe, WebCutAnimationParams, WebCutAnimationType, WebCutSource } from '../../types';
import { VisibleSprite } from '@webav/av-cliper';

/**
 * 动画管理器类
 */
export class WebCutAnimationManager {
    private animations: Map<string, WebCutBaseAnimation> = new Map();

    /**
     * 注册动画
     * @param animation 动画实例
     */
    registerAnimation(animation: WebCutBaseAnimation): void {
        this.animations.set(animation.name, animation);
    }

    /**
     * 获取动画实例
     * @param name 动画名称
     * @returns 动画实例
     */
    getAnimation(name: string): WebCutBaseAnimation | undefined {
        return this.animations.get(name);
    }

    /**
     * 获取所有注册的动画名称
     * @returns 动画名称数组
     */
    getAnimationNames(): string[] {
        return Array.from(this.animations.keys());
    }

    /**
     * 获取动画的默认配置
     */
    getAnimationDefaults() {
        const names = this.getAnimationNames();
        const defaults: Record<string, {
            type: WebCutAnimationType | string;
            name: string;
            title?: string;
            defaultParams: WebCutAnimationParams;
        }> = {};
        names.forEach((name) => {
            const anim = this.getAnimation(name);
            if (!anim) {
                return;
            }
            defaults[name] = {
                name,
                title: anim.title || anim.name,
                type: anim.type,
                defaultParams: anim?.defaultParams || {},
            };
        });
        return defaults;
    }

    /**
     * 应用动画到素材
     * @returns 动画参数
     */
    applyAnimation(data: {
        /** 素材对象 */
        sprite: VisibleSprite;
        /** 动画名 */
        animationName: string;
        /** 动画参数 */
        params: WebCutAnimationParams;
        /** 画布大小 */
        canvasSize: { width: number; height: number };
        /** 最大动画时长 */
        animationDuration: number;
        /** 初始状态，所有动画都是基于该初始状态来执行的，当移除动画时，会将素材恢复到该初始状态 */
        initState: Required<WebCutAnimationKeyframe[keyof WebCutAnimationKeyframe]>;
    }): {
        params: WebCutAnimationParams;
        keyframe: WebCutAnimationKeyframe;
    } | null {
        const { sprite, animationName, params, canvasSize, animationDuration, initState } = data;

        const anim = this.getAnimation(animationName);
        if (!anim) {
            return null;
        }

        const keyframeParams = anim.processParams(params || {}, animationDuration);
        const keyframe: WebCutAnimationKeyframe = anim.calcKeyframe(initState, canvasSize, keyframeParams);

        // 恢复素材到初始状态
        const { x, y, w, h, angle, opacity } = initState!;
        Object.assign(sprite.rect, { x, y, w, h, angle });
        sprite.opacity = opacity || 1;

        // 禁止交互
        sprite.interactable = 'selectable';
        sprite.setAnimation(keyframe, keyframeParams);

        return {
            params: keyframeParams,
            keyframe,
        };
    }

    /**
     * 对已经应用的动画作参数调整，特别是在时长发生变化时
     * @param data
     */
    adjustAnimationParams(data: {
        /** 源对象 */
        source: WebCutSource;
        /** 动画总时长 */
        animationDuration: number;
    }) {
        const { source, animationDuration } = data;
        // 当时长发生变化，重新计算动画参数
        if (!source.meta.animation) {
            return;
        }
        const { name, params } = source.meta.animation;
        const anim = this.getAnimation(name);
        if (!anim) {
            return;
        }

        const sprite = source.sprite;
        const keyframe = source.meta.animation.keyframe;

        // 计算新的动画参数
        const keyframeParams = anim.processParams(params || {}, animationDuration);
        source.meta.animation.params = keyframeParams;

        // 禁止交互
        sprite.interactable = 'selectable';
        sprite.setAnimation(keyframe, keyframeParams);
    }

    async clearAnimation(data: {
        sprite: VisibleSprite;
        initState: Required<WebCutAnimationKeyframe[keyof WebCutAnimationKeyframe]>;
    }) {
        const { sprite, initState } = data;

        // 恢复素材到初始状态
        const { x, y, w, h, angle, opacity } = initState!;
        Object.assign(sprite.rect, { x, y, w, h, angle });
        sprite.opacity = opacity || 1;

        if (sprite.setAnimation) {
            sprite.setAnimation({}, { duration: 0 });
        }
        sprite.interactable = 'interactive';
    }

    /**
     * 关闭动画管理器，释放所有动画资源
     */
    dispose(): void {
        for (const animation of this.animations.values()) {
            animation.dispose();
        }
        this.animations.clear();
    }
}

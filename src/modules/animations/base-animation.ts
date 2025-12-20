import { WebCutAnimationKeyframe, WebCutAnimationType, WebCutAnimationParams, WebCutAnimationKeyframeConfig } from "../../types";
import { each } from "ts-fns";
import { autoFitRect } from '../../libs';

/**
 * 动画基类
 */
export abstract class WebCutBaseAnimation {
    abstract name: string;
    abstract title: string;
    abstract type: WebCutAnimationType | string;
    abstract defaultParams: WebCutAnimationParams;

    defineKeyframe(_currentState: WebCutAnimationKeyframe[keyof WebCutAnimationKeyframe], _canvasSize: { width: number; height: number }, _params: WebCutAnimationParams): WebCutAnimationKeyframeConfig {
        throw new Error(`Animation.defineKeyframe not implemented.`);
    }

    /**
     * 计算关键帧数据
     * @param currentState 当前需要用于计算的对象数据
     * @param canvasSize 画布尺寸
     * @param params 动画参数
     * @returns 计算后的关键帧数据
     */
    calcKeyframe(currentState: WebCutAnimationKeyframe[keyof WebCutAnimationKeyframe], canvasSize: { width: number; height: number }, params: WebCutAnimationParams): WebCutAnimationKeyframe {
        const canvasWidth = canvasSize.width;
        const canvasHeight = canvasSize.height;
        const {
            x: currentX,
            y: currentY,
            w: currentW,
            h: currentH,
            angle: currentAngle = 0,
            opacity: currentOpacity = 1,
        } = currentState!;

        const keyframe: WebCutAnimationKeyframe = {};
        const keyframeConfig = this.defineKeyframe(currentState, canvasSize, params);

        each(keyframeConfig, (conf: WebCutAnimationKeyframeConfig[keyof WebCutAnimationKeyframeConfig], key) => {
            const {
                offsetX, offsetY, scale, rotate,
                x, y, w, h, angle, opacity
            } = conf || {};

            const data = keyframe[key] = {
                x: currentX,
                y: currentY,
                w: currentW,
                h: currentH,
                angle: currentAngle,
                opacity: currentOpacity,
            };

            if (typeof x === 'number') {
                data.x = x;
            }
            else if (offsetX) {
                if (Number.isFinite(offsetX)) {
                    data.x = currentX! + offsetX;
                }
                // 正无穷，也就是画面移动到最右边隐藏起来
                else if (offsetX > 0) {
                    data.x = canvasWidth + 10;
                }
                // 负无穷，也就是画面移动到最左边隐藏起来
                else if (offsetX < 0) {
                    data.x = -currentW! - 10;
                }
            }

            if (typeof y === 'number') {
                data.y = y;
            }
            else if (offsetY) {
                if (Number.isFinite(offsetY)) {
                    data.y = currentY! + offsetY;
                }
                // 正无穷，也就是画面移动到最下边隐藏起来
                else if (offsetY > 0) {
                    data.y = canvasHeight + 10;
                }
                // 负无穷，也就是画面移动到最上边隐藏起来
                else if (offsetY < 0) {
                    data.y = -currentH! - 10;
                }
            }

            if (typeof w === 'number' && w >= 0) {
                // @ts-ignore
                data.w = w;
            }
            if (typeof h === 'number' && h >= 0) {
                // @ts-ignore
                data.h = h;
            }

            // 对于通过scale来放大缩小
            if (typeof scale === 'number' && scale >= 0) {
                // @ts-ignore
                data.w = currentW * scale;
                // @ts-ignore
                data.h = currentH * scale;
                // 缩放时，需要将画面居中
                const info = autoFitRect(canvasSize, { width: data.w, height: data.h });
                data.x = info.x;
                data.y = info.y;
                // TODO 缩放时，是否要处理 offsetX, offsetY ？
            }

            if (typeof angle === 'number') {
                data.angle = angle;
            }
            else if (typeof rotate === 'number' && rotate !== 0) {
                // rotate为deg，我们需要转为rad
                // @ts-ignore
                data.angle = rotate * Math.PI / 180;
            }

            if (typeof opacity === 'number' && opacity >= 0 && opacity < 1) {
                // @ts-ignore
                data.opacity = opacity;
            }
        });
        return keyframe;
    }

    /**
     * 处理动画参数
     * @param params 动画参数
     * @param maxDuration 动画能够在画布中执行的最长时间（一般指segment的长度）
     * @returns 处理后的动画参数
     */
    processParams(params: WebCutAnimationParams, maxDuration: number): WebCutAnimationParams {
        let {
            duration = this.defaultParams.duration,
            delay = this.defaultParams.delay,
            iterCount = this.defaultParams.iterCount,
        } = params;

        // 动画时长不能超过segment时长
        duration = Math.min(duration, maxDuration);

        // 出场入场只能执行1次
        if (this.type === WebCutAnimationType.Enter || this.type === WebCutAnimationType.Exit) {
            iterCount = 1;
        }
        // 前端不会主动去调整iterCount，因此，我们直接从defaultParams中去判断是否为持续动画
        else if (!this.defaultParams.iterCount) {
            iterCount = Math.ceil(maxDuration / duration);
        }

        // 对于出场，要让动画在segment结束时结束，通过延迟执行来实现
        if (this.type === WebCutAnimationType.Exit) {
            delay = maxDuration - duration;
        }

        return { duration, delay, iterCount };
    }

    /**
     * 清空资源
     */
    dispose(): void {
    }
}

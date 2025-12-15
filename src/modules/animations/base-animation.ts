import { WebCutAnimationKeyframe, WebCutAnimationType, WebCutAnimationParams, WebCutAnimationKeyframeConfig } from "../../types";
import { each } from "ts-fns";
import { autoFitRect } from '../../libs';

/**
 * 动画基类
 */
export abstract class WebCutBaseAnimation {
    abstract name: string;
    abstract title: string;
    abstract type: WebCutAnimationType;
    abstract defaultKeyframe: WebCutAnimationKeyframeConfig;
    abstract defaultParams: WebCutAnimationParams;

    /**
     * 计算关键帧数据
     * @param currentState 当前需要用于计算的对象数据
     * @param canvasSize 画布尺寸
     * @returns 计算后的关键帧数据
     */
    calcKeyframe(currentState: WebCutAnimationKeyframe[keyof WebCutAnimationKeyframe], canvasSize: { width: number; height: number }): WebCutAnimationKeyframe {
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

        each(this.defaultKeyframe, (conf: WebCutAnimationKeyframeConfig[keyof WebCutAnimationKeyframeConfig], key) => {
            const { offsetX, offsetY, scale, rotate, opacity } = conf || {};
            const data = keyframe[key] = {
                x: currentX,
                y: currentY,
                w: currentW,
                h: currentH,
                angle: currentAngle,
                opacity: currentOpacity,
            };
            if (offsetX) {
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
            if (offsetY) {
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
            if (typeof rotate === 'number' && rotate !== 0) {
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
        let { duration = 2e6, delay = 0, iterCount = 1 } = params;
        // 动画时长不能超过segment时长
        duration = Math.min(duration || this.defaultParams.duration || 0, maxDuration);

        // 出场入场只能执行1次
        if (this.type === WebCutAnimationType.Enter || this.type === WebCutAnimationType.Exit) {
            iterCount = 1;
        }
        else if (this.type === WebCutAnimationType.Motion && !iterCount) {
            iterCount = this.defaultParams.iterCount || Math.ceil(maxDuration / duration);
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

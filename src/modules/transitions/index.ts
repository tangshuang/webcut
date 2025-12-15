import { TransitionManager } from './transition-manager';
import { FadeTransition, SlideTransition, ZoomTransition, BlindsTransition, DissolveTransition } from './effects-transitions';

// 创建全局转场管理器实例
export const transitionManager = new TransitionManager();

// 注册所有转场效果
transitionManager.registerTransition(new FadeTransition());
transitionManager.registerTransition(new SlideTransition());
transitionManager.registerTransition(new ZoomTransition());
transitionManager.registerTransition(new BlindsTransition());
transitionManager.registerTransition(new DissolveTransition());

export { WebCutBaseTransition, type WebCutTransitionConfig } from './base-transition';

import { AnimationManager } from './animation-manager';
import {
  WebCutFadeInAnimation,
  WebCutFadeOutAnimation,
  WebCutSlideInLeftAnimation,
  WebCutSlideInRightAnimation,
  WebCutSlideInTopAnimation,
  WebCutSlideInBottomAnimation,
  WebCutZoomInAnimation,
  WebCutRotateInAnimation,
  WebCutSlideOutLeftAnimation,
  WebCutSlideOutRightAnimation,
  WebCutSlideOutTopAnimation,
  WebCutSlideOutBottomAnimation,
  WebCutZoomOutAnimation,
  WebCutRotateOutAnimation,
  WebCutPulseAnimation,
  WebCutShakeAnimation,
  WebCutBounceAnimation,
  WebCutSwingAnimation,
  WebCutFlashAnimation
} from './preset-animations';

export * from './base-animation';
export * from './animation-manager';
export * from './preset-animations';

/**
 * 动画管理器单例
 */
export const animationManager = new AnimationManager();

// 注册预设动画
animationManager.registerAnimation(new WebCutFadeInAnimation());
animationManager.registerAnimation(new WebCutFadeOutAnimation());
animationManager.registerAnimation(new WebCutSlideInLeftAnimation());
animationManager.registerAnimation(new WebCutSlideInRightAnimation());
animationManager.registerAnimation(new WebCutSlideInTopAnimation());
animationManager.registerAnimation(new WebCutSlideInBottomAnimation());
animationManager.registerAnimation(new WebCutZoomInAnimation());
animationManager.registerAnimation(new WebCutRotateInAnimation());
animationManager.registerAnimation(new WebCutSlideOutLeftAnimation());
animationManager.registerAnimation(new WebCutSlideOutRightAnimation());
animationManager.registerAnimation(new WebCutSlideOutTopAnimation());
animationManager.registerAnimation(new WebCutSlideOutBottomAnimation());
animationManager.registerAnimation(new WebCutZoomOutAnimation());
animationManager.registerAnimation(new WebCutRotateOutAnimation());
animationManager.registerAnimation(new WebCutPulseAnimation());
animationManager.registerAnimation(new WebCutShakeAnimation());
animationManager.registerAnimation(new WebCutBounceAnimation());
animationManager.registerAnimation(new WebCutSwingAnimation());
animationManager.registerAnimation(new WebCutFlashAnimation());

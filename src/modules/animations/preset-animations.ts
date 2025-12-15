import { WebCutBaseAnimation } from './base-animation';
import { WebCutAnimationType, WebCutAnimationParams, WebCutAnimationKeyframeConfig } from '../../types';

/**
 * 淡入动画实现类
 */
export class WebCutFadeInAnimation extends WebCutBaseAnimation {
  name = 'fadeIn';
  title = '淡入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { opacity: 0 },
    'to': { opacity: 1 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 淡出动画实现类
 */
export class WebCutFadeOutAnimation extends WebCutBaseAnimation {
  name = 'fadeOut';
  title = '淡出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { opacity: 1 },
    'to': { opacity: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 从左滑入动画实现类
 */
export class WebCutSlideInLeftAnimation extends WebCutBaseAnimation {
  name = 'slideInLeft';
  title = '从左滑入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetX: -Infinity },
    'to': { offsetX: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 从右滑入动画实现类
 */
export class WebCutSlideInRightAnimation extends WebCutBaseAnimation {
  name = 'slideInRight';
  title = '从右滑入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetX: Infinity },
    'to': { offsetX: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 从上滑入动画实现类
 */
export class WebCutSlideInTopAnimation extends WebCutBaseAnimation {
  name = 'slideInTop';
  title = '从上滑入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetY: -Infinity },
    'to': { offsetY: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 从下滑入动画实现类
 */
export class WebCutSlideInBottomAnimation extends WebCutBaseAnimation {
  name = 'slideInBottom';
  title = '从下滑入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetY: Infinity },
    'to': { offsetY: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 放大进入动画实现类
 */
export class WebCutZoomInAnimation extends WebCutBaseAnimation {
  name = 'zoomIn';
  title = '放大进入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { scale: 0 },
    'to': { scale: 1 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 旋转进入动画实现类
 */
export class WebCutRotateInAnimation extends WebCutBaseAnimation {
  name = 'rotateIn';
  title = '旋转进入';
  type = WebCutAnimationType.Enter;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { rotate: -180, opacity: 0 },
    'to': { rotate: 0, opacity: 1 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 向左滑出动画实现类
 */
export class WebCutSlideOutLeftAnimation extends WebCutBaseAnimation {
  name = 'slideOutLeft';
  title = '向左滑出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetX: 0 },
    'to': { offsetX: -Infinity }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 向右滑出动画实现类
 */
export class WebCutSlideOutRightAnimation extends WebCutBaseAnimation {
  name = 'slideOutRight';
  title = '向右滑出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetX: 0 },
    'to': { offsetX: Infinity }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 向上滑出动画实现类
 */
export class WebCutSlideOutTopAnimation extends WebCutBaseAnimation {
  name = 'slideOutTop';
  title = '向上滑出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetY: 0 },
    'to': { offsetY: -Infinity }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 向下滑出动画实现类
 */
export class WebCutSlideOutBottomAnimation extends WebCutBaseAnimation {
  name = 'slideOutBottom';
  title = '向下滑出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { offsetY: 0 },
    'to': { offsetY: Infinity }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 缩小退出动画实现类
 */
export class WebCutZoomOutAnimation extends WebCutBaseAnimation {
  name = 'zoomOut';
  title = '缩小退出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { scale: 1 },
    'to': { scale: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 旋转退出动画实现类
 */
export class WebCutRotateOutAnimation extends WebCutBaseAnimation {
  name = 'rotateOut';
  title = '旋转退出';
  type = WebCutAnimationType.Exit;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    'from': { rotate: 0, opacity: 1 },
    'to': { rotate: 180, opacity: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 2e6,
    delay: 0,
    iterCount: 1
  };
}

/**
 * 脉冲动画实现类
 */
export class WebCutPulseAnimation extends WebCutBaseAnimation {
  name = 'pulse';
  title = '脉冲';
  type = WebCutAnimationType.Motion;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    '0%': { scale: 1 },
    '50%': { scale: 1.1 },
    '100%': { scale: 1 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 1e6 * 0.2,
    delay: 0,
    iterCount: 0,
  };
}

/**
 * 抖动动画实现类
 */
export class WebCutShakeAnimation extends WebCutBaseAnimation {
  name = 'shake';
  title = '抖动';
  type = WebCutAnimationType.Motion;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    '0%': { offsetX: 0 },
    '25%': { offsetX: -10 },
    '50%': { offsetX: 10 },
    '75%': { offsetX: -10 },
    '100%': { offsetX: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 1e6 * 0.2,
    delay: 0,
    iterCount: 0,
  };
}

/**
 * 弹跳动画实现类
 */
export class WebCutBounceAnimation extends WebCutBaseAnimation {
  name = 'bounce';
  title = '弹跳';
  type = WebCutAnimationType.Motion;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    '0%': { offsetY: 0 },
    '25%': { offsetY: -50 },
    '50%': { offsetY: 0 },
    '75%': { offsetY: -25 },
    '100%': { offsetY: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 1e6 * 0.8,
    delay: 0,
    iterCount: 0,
  };
}

/**
 * 摆动动画实现类
 */
export class WebCutSwingAnimation extends WebCutBaseAnimation {
  name = 'swing';
  title = '摆动';
  type = WebCutAnimationType.Motion;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    '0%': { rotate: 0 },
    '25%': { rotate: 15 },
    '50%': { rotate: 0 },
    '75%': { rotate: -15 },
    '100%': { rotate: 0 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 1e6 * 0.8,
    delay: 0,
    iterCount: 0,
  };
}

/**
 * 闪烁动画实现类
 */
export class WebCutFlashAnimation extends WebCutBaseAnimation {
  name = 'flash';
  title = '闪烁';
  type = WebCutAnimationType.Motion;
  defaultKeyframe: WebCutAnimationKeyframeConfig = {
    '0%': { opacity: 1 },
    '25%': { opacity: 0 },
    '50%': { opacity: 1 },
    '75%': { opacity: 0 },
    '100%': { opacity: 1 }
  };
  defaultParams: WebCutAnimationParams = {
    duration: 1e6,
    delay: 0,
    iterCount: 0,
  };
}

// 导入基础类和类型
import { WebCutBaseFilter, type WebCutFilterParams } from './base-filter';
import { FilterManager } from './filter-manager';

// 导入滤镜实现
import {
  WebCutGrayscaleFilter,
  WebCutBlurFilter,
  WebCutBrightnessFilter,
  WebCutContrastFilter,
  WebCutSaturateFilter
} from './css-filters';

// 重新导出基础类和类型
export { WebCutBaseFilter, FilterManager, type WebCutFilterParams };

// 创建全局滤镜管理器实例
export const filterManager = new FilterManager();

// 注册内置滤镜
filterManager.registerFilter(new WebCutGrayscaleFilter());
filterManager.registerFilter(new WebCutBlurFilter());
filterManager.registerFilter(new WebCutBrightnessFilter());
filterManager.registerFilter(new WebCutContrastFilter());
filterManager.registerFilter(new WebCutSaturateFilter());

// 长宽比档位（展示顺序）
export const ASPECT_RATIOS = ['21:9', '16:9', '4:3', '9:16', '3:4', '1:1'] as const;
export type WebCutAspectRatio = (typeof ASPECT_RATIOS)[number];

// 各长宽比的宽度换算系数（width = height × 系数）
const ASPECT_RATIO_WIDTH_FACTORS: Record<WebCutAspectRatio, number> = {
  '21:9': 21 / 9,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '9:16': 9 / 16,
  '3:4': 3 / 4,
  '1:1': 1,
};

// 四舍五入到最接近的偶数（视频编码要求宽高为偶数）
function toEven(value: number) {
  return Math.round(value / 2) * 2;
}

/**
 * 以档位高度为基准生成各长宽比的标准尺寸表。
 *
 * 约定：除 21:9 外，所有比例的高度一律取档位高度（如 480P 的 9:16 为 270×480）；
 * 21:9 超宽屏按 ultrawideHeight 降档高度计算，避免超宽画布（沿用既有数据：
 * 1080P/768P 共用 768 高、720P/576P 共用 576 高，其余档位用自身高度）。
 *
 * 关键约束：任一条目四舍五入后的实际宽高比，经 calcAspectRatio 最近匹配必须能反解回
 * 它自己的档位 key——否则切换分辨率时（先反推比例再查表）长宽比会被静默改写。
 * 因此禁止手写尺寸表，新增档位一律通过本函数生成。
 */
function buildAspectRatioSizeMap(height: number, ultrawideHeight = height): Record<WebCutAspectRatio, { width: number; height: number }> {
  const map = {} as Record<WebCutAspectRatio, { width: number; height: number }>;
  for (const ratio of ASPECT_RATIOS) {
    const baseHeight = ratio === '21:9' ? ultrawideHeight : height;
    map[ratio] = {
      width: toEven(baseHeight * ASPECT_RATIO_WIDTH_FACTORS[ratio]),
      height: baseHeight,
    };
  }
  return map;
}

// 长宽比对应 width/height 的 map（1080P 档，公共导出）
export const aspectRatioMap: Record<WebCutAspectRatio, { width: number; height: number }> = buildAspectRatioSizeMap(1080, 768);

// 画布分辨率档位（按清晰度从高到低）
export const RESOLUTIONS = ['1080P', '768P', '720P', '576P', '544P', '540P', '480P', '360P'] as const;

// 画布帧率档位（平台支持的常用值，15~120）
export const FPS_OPTIONS = [15, 20, 24, 25, 30, 48, 50, 60, 90, 120] as const;

// 分辨率档位对应的长宽比尺寸映射表
export const aspectRatioResolutionMaps = {
  '1080P': aspectRatioMap,
  '768P': buildAspectRatioSizeMap(768),
  '720P': buildAspectRatioSizeMap(720, 576),
  '576P': buildAspectRatioSizeMap(576),
  '544P': buildAspectRatioSizeMap(544),
  '540P': buildAspectRatioSizeMap(540),
  '480P': buildAspectRatioSizeMap(480),
  '360P': buildAspectRatioSizeMap(360),
};

// 长宽比对应 width/height 的 map
export const aspectRatioMap = {
  // 以1080P为基准，保证长宽为偶数
  '21:9': { width: 1792, height: 768 }, // 21:9 等比放大，取接近1080高度的偶数
  '16:9': { width: 1920, height: 1080 }, // 标准1080P
  '4:3': { width: 1440, height: 1080 },  // 4:3 等比放大，高度1080，宽度取偶数
  '9:16': { width: 608, height: 1080 },  // 9:16 等比放大，高度1080，宽度取偶数
  '3:4': { width: 810, height: 1080 },   // 3:4 等比放大，高度1080，宽度取偶数
  '1:1': { width: 1080, height: 1080 },  // 1:1 等比放大，高度1080，宽度取偶数
} as const;

export const aspectRatio720PMap = {
  // 以720P为基准，保证长宽为偶数
  '21:9': { width: 1280, height: 576 }, // 21:9 等比放大，取接近720高度的偶数
  '16:9': { width: 1280, height: 720 }, // 标准720P
  '4:3': { width: 960, height: 720 },  // 4:3 等比放大，高度720，宽度取偶数
  '9:16': { width: 480, height: 720 },  // 9:16 等比放大，高度720，宽度取偶数
  '3:4': { width: 648, height: 720 },   // 3:4 等比放大，高度720，宽度取偶数
  '1:1': { width: 720, height: 720 },  // 1:1 等比放大，高度720，宽度取偶数
};

export const aspectRatio480PMap = {
  // 以480P为基准，保证长宽为偶数
  '21:9': { width: 854, height: 480 }, // 21:9 等比放大，取接近480高度的偶数
  '16:9': { width: 854, height: 480 }, // 标准480P
  '4:3': { width: 648, height: 480 },  // 4:3 等比放大，高度480，宽度取偶数
  '9:16': { width: 480, height: 480 },  // 9:16 等比放大，高度480，宽度取偶数
  '3:4': { width: 480, height: 648 },   // 3:4 等比放大，高度480，宽度取偶数
  '1:1': { width: 480, height: 480 },  // 1:1 等比放大，高度480，宽度取偶数
};

export const aspectRatio360PMap = {
  // 以360P为基准，保证长宽为偶数
  '21:9': { width: 640, height: 360 }, // 21:9 等比放大，取接近360高度的偶数
  '16:9': { width: 640, height: 360 }, // 标准360P
  '4:3': { width: 480, height: 360 },  // 4:3 等比放大，高度360，宽度取偶数
  '9:16': { width: 360, height: 360 },  // 9:16 等比放大，高度360，宽度取偶数
  '3:4': { width: 360, height: 480 },   // 3:4 等比放大，高度360，宽度取偶数
  '1:1': { width: 360, height: 360 },  // 1:1 等比放大，高度360，宽度取偶数
};

export const aspectRatio768PMap = {
  // 以768P为基准，保证长宽为偶数
  '21:9': { width: 1792, height: 768 },
  '16:9': { width: 1366, height: 768 },
  '4:3': { width: 1024, height: 768 },
  '9:16': { width: 432, height: 768 },
  '3:4': { width: 576, height: 768 },
  '1:1': { width: 768, height: 768 },
};

export const aspectRatio576PMap = {
  // 以576P为基准，保证长宽为偶数
  '21:9': { width: 1344, height: 576 },
  '16:9': { width: 1024, height: 576 },
  '4:3': { width: 768, height: 576 },
  '9:16': { width: 324, height: 576 },
  '3:4': { width: 432, height: 576 },
  '1:1': { width: 576, height: 576 },
};

export const aspectRatio544PMap = {
  // 以544P为基准，保证长宽为偶数
  '21:9': { width: 1270, height: 544 },
  '16:9': { width: 968, height: 544 },
  '4:3': { width: 726, height: 544 },
  '9:16': { width: 306, height: 544 },
  '3:4': { width: 408, height: 544 },
  '1:1': { width: 544, height: 544 },
};

export const aspectRatio540PMap = {
  // 以540P为基准，保证长宽为偶数
  '21:9': { width: 1260, height: 540 },
  '16:9': { width: 960, height: 540 },
  '4:3': { width: 720, height: 540 },
  '9:16': { width: 304, height: 540 },
  '3:4': { width: 406, height: 540 },
  '1:1': { width: 540, height: 540 },
};

// 画布分辨率档位（按清晰度从高到低）
export const RESOLUTIONS = ['1080P', '768P', '720P', '576P', '544P', '540P', '480P', '360P'] as const;

// 分辨率档位对应的长宽比尺寸映射表
export const aspectRatioResolutionMaps = {
  '1080P': aspectRatioMap,
  '768P': aspectRatio768PMap,
  '720P': aspectRatio720PMap,
  '576P': aspectRatio576PMap,
  '544P': aspectRatio544PMap,
  '540P': aspectRatio540PMap,
  '480P': aspectRatio480PMap,
  '360P': aspectRatio360PMap,
};

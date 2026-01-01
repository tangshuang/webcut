# WebAV 贴纸工具实现调研

## 1. 概述

本调研旨在研究如何在基于 WebAV 的视频编辑项目中实现贴纸功能。贴纸是一种常见的视频编辑素材，允许用户在视频上添加静态或动态的图像元素，增强视频的表现力和趣味性。

## 2. WebAV 核心概念

### 2.1 WebAV 库简介

项目目前使用的 WebAV 相关库：
- `@webav/av-canvas`：用于在 Canvas 上渲染和编辑视频
- `@webav/av-cliper`：用于视频剪辑和处理

### 2.2 素材类型系统

当前项目支持的素材类型：
```typescript
export type WebCutMaterialType = 'video' | 'audio' | 'image' | 'text';
```

我们需要在此基础上添加 `'sticker'` 类型，以支持贴纸素材。

## 3. 贴纸实现方案

### 3.1 贴纸的本质

贴纸本质上是一种特殊的图像素材，具有以下特点：
- 通常带有透明背景（PNG 格式）
- 可以调整大小、旋转、缩放
- 可以在视频时间线上定位和调整时长
- 支持动态效果（如动画贴纸）

### 3.2 技术选型

根据项目现有架构，贴纸可以使用 `ImgClip` 类实现，与图像和文本素材类似。`ImgClip` 是 WebAV 中用于处理图像素材的核心类，支持将图像添加到视频画布上。

## 4. 代码实现

### 4.1 扩展素材类型

首先，我们需要扩展项目的素材类型定义：

```typescript
// src/types/index.ts
export type WebCutMaterialType = 'video' | 'audio' | 'image' | 'text' | 'sticker';
```

### 4.2 实现贴纸素材的添加功能

修改 `push` 函数以支持贴纸类型：

```typescript
// src/hooks/index.ts
import { ImgClip, VideoClip, AudioClip, TextClip } from '@webav/av-cliper';

async function push(type: 'video' | 'audio' | 'image' | 'text' | 'sticker', source: string | File, meta: WebCutMaterialMeta = {}): Promise<string> {
  // ... 现有代码 ...
  let clip: VideoClip | AudioClip | ImgClip | TextClip;
  let spriteCompInst: any;
  let spriteElem: HTMLElement;

  if (type === 'video') {
    // ... 现有视频处理代码 ...
  } else if (type === 'audio') {
    // ... 现有音频处理代码 ...
  } else if (type === 'image' || type === 'sticker') {
    // 贴纸和图像使用相同的 ImgClip 处理
    const img = new Image();
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
    await new Promise(resolve => { img.onload = resolve; });
    
    // 为贴纸设置特定的元数据
    const stickerMeta = type === 'sticker' ? { ...meta, isSticker: true } : meta;
    
    clip = new ImgClip(img, {
      duration: type === 'sticker' ? (meta.duration || 5) : undefined, // 贴纸默认时长 5 秒
      ...stickerMeta
    });
    
    spriteCompInst = new AVCanvasSprite({
      comp: clip,
      offsetTime: offsetTime,
      zIndex: nextZIndex(),
      visible
    });
    spriteElem = spriteCompInst.element;
    
    // 为贴纸添加特殊样式或处理
    if (type === 'sticker') {
      spriteElem.classList.add('sticker-sprite');
    }
  } else if (type === 'text') {
    // ... 现有文本处理代码 ...
  }
  
  // ... 现有代码 ...
}
```

### 4.3 创建贴纸素材库组件

可以参考现有的图像素材库组件，创建贴纸素材库：

```vue
<!-- src/views/library/sticker.vue -->
<template>
  <div class="sticker-library">
    <h3>贴纸库</h3>
    <div class="sticker-grid">
      <div
        v-for="sticker in stickers"
        :key="sticker.id"
        class="sticker-item"
        draggable="true"
        @dragstart="onDragStart($event, sticker)"
      >
        <img :src="sticker.url" :alt="sticker.name" />
        <span>{{ sticker.name }}</span>
      </div>
    </div>
    <input
      type="file"
      accept="image/png,image/gif"
      @change="onFileChange"
      class="sticker-upload"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePlayer } from '@/hooks';

const { t } = useI18n();
const { push } = usePlayer();

const stickers = ref([
  // 示例贴纸数据
  { id: 1, name: '笑脸', url: '/stickers/smile.png' },
  { id: 2, name: '爱心', url: '/stickers/heart.png' },
  { id: 3, name: '星星', url: '/stickers/star.png' }
]);

const onDragStart = (event: DragEvent, sticker: any) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('sticker', JSON.stringify(sticker));
  }
};

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    await push('sticker', file);
  }
};
</script>

<style scoped>
.sticker-library {
  padding: 16px;
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.sticker-item {
  cursor: pointer;
  text-align: center;
}

.sticker-item img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.sticker-upload {
  margin-top: 16px;
}
</style>
```

### 4.4 实现贴纸的属性编辑

为贴纸添加专属的属性编辑器，允许用户调整贴纸的透明度、旋转角度、缩放比例等：

```vue
<!-- src/components/sticker-properties.vue -->
<template>
  <div class="sticker-properties">
    <h4>贴纸属性</h4>
    <div class="property-item">
      <label>{{ t('透明度') }}</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        v-model.number="opacity"
        @input="updateOpacity"
      />
      <span>{{ (opacity * 100).toFixed(0) }}%</span>
    </div>
    <div class="property-item">
      <label>{{ t('旋转') }}</label>
      <input
        type="range"
        min="0"
        max="360"
        step="1"
        v-model.number="rotation"
        @input="updateRotation"
      />
      <span>{{ rotation }}°</span>
    </div>
    <div class="property-item">
      <label>{{ t('缩放') }}</label>
      <input
        type="range"
        min="0.1"
        max="3"
        step="0.1"
        v-model.number="scale"
        @input="updateScale"
      />
      <span>{{ scale.toFixed(1) }}x</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  spriteComp: any;
}>();

const opacity = ref(1);
const rotation = ref(0);
const scale = ref(1);

watch(() => props.spriteComp, (newSprite) => {
  if (newSprite) {
    // 从 sprite 组件中获取当前属性值
    opacity.value = newSprite.opacity || 1;
    rotation.value = newSprite.rotation || 0;
    scale.value = newSprite.scale || 1;
  }
}, { immediate: true });

const updateOpacity = () => {
  if (props.spriteComp) {
    props.spriteComp.opacity = opacity.value;
  }
};

const updateRotation = () => {
  if (props.spriteComp) {
    props.spriteComp.rotation = rotation.value;
  }
};

const updateScale = () => {
  if (props.spriteComp) {
    props.spriteComp.scale = scale.value;
  }
};
</script>

<style scoped>
.sticker-properties {
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.property-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.property-item label {
  width: 80px;
  margin-right: 12px;
}

.property-item input[type="range"] {
  flex: 1;
  margin-right: 12px;
}
</style>
```

## 5. 动态贴纸支持

对于动态贴纸（如 GIF 或序列帧动画），可以使用以下方案实现：

### 5.1 GIF 贴纸实现

```typescript
// 扩展 ImgClip 以支持 GIF
import { ImgClip } from '@webav/av-cliper';

class GifClip extends ImgClip {
  private gifElement: HTMLImageElement;
  private animationFrameId: number | null = null;
  private startTime: number = 0;

  constructor(gifUrl: string, opts: any) {
    super(new Image(), opts);
    this.gifElement = new Image();
    this.gifElement.src = gifUrl;
    this.gifElement.onload = () => {
      // 初始化 GIF 动画
      this.startTime = performance.now();
      this.animate();
    };
  }

  private animate = () => {
    // 更新 GIF 帧
    this.render();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  render(ctx: CanvasRenderingContext2D) {
    // 绘制当前 GIF 帧
    ctx.drawImage(this.gifElement, 0, 0, this.width, this.height);
  }

  destroy() {
    super.destroy();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
```

### 5.2 序列帧贴纸实现

```typescript
class SequenceClip extends ImgClip {
  private frames: HTMLImageElement[] = [];
  private currentFrameIndex = 0;
  private frameDuration: number;
  private lastFrameTime = 0;

  constructor(frameUrls: string[], frameDuration: number = 100, opts: any) {
    super(new Image(), opts);
    this.frameDuration = frameDuration;
    
    // 预加载所有帧
    const loadPromises = frameUrls.map(url => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          this.frames.push(img);
          resolve(img);
        };
      });
    });
    
    Promise.all(loadPromises).then(() => {
      // 所有帧加载完成后开始动画
      this.startTime = performance.now();
      this.animate();
    });
  }

  private animate = () => {
    const now = performance.now();
    if (now - this.lastFrameTime >= this.frameDuration) {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
      this.lastFrameTime = now;
      this.render();
    }
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  render(ctx: CanvasRenderingContext2D) {
    const frame = this.frames[this.currentFrameIndex];
    if (frame) {
      ctx.drawImage(frame, 0, 0, this.width, this.height);
    }
  }
}
```

## 6. 贴纸素材管理

### 6.1 贴纸分类

建议将贴纸按照不同主题进行分类管理，便于用户查找和使用：

```typescript
export interface StickerCategory {
  id: string;
  name: string;
  stickers: Sticker[];
}

export interface Sticker {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  tags: string[];
}
```

### 6.2 贴纸加载策略

- 预加载常用贴纸，提高用户体验
- 对于大量贴纸，采用懒加载策略
- 支持用户上传自定义贴纸

## 7. 性能优化

### 7.1 贴纸渲染优化

- 使用 Canvas 离屏渲染处理复杂贴纸效果
- 对静态贴纸进行缓存
- 减少贴纸的重绘次数

### 7.2 内存管理

- 及时销毁不再使用的贴纸资源
- 限制同时显示的贴纸数量
- 对大型贴纸进行压缩处理

## 8. 总结

基于 WebAV 实现贴纸功能是一个可行的方案，主要包括以下步骤：

1. 扩展项目的素材类型，添加 `sticker` 类型
2. 修改 `push` 函数，支持贴纸素材的添加
3. 创建贴纸素材库组件
4. 实现贴纸属性编辑器
5. 支持静态和动态贴纸
6. 优化贴纸的渲染性能

通过以上实现，可以为视频编辑项目添加完整的贴纸功能，提升用户的编辑体验和视频表现力。

## 9. 参考资料

- [WebAV 官方文档](https://webav.art/) 
- [Canvas API 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API)
- [Web Components 文档](https://developer.mozilla.org/zh-CN/docs/Web/Web_Components)
- [Vue 3 官方文档](https://vuejs.org/guide/introduction.html)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
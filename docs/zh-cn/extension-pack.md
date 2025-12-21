# 扩展包

## 1. 概述

ExtensionPack 是 WebCut 视频编辑器提供的一种扩展机制，允许开发者通过实现特定接口来扩展编辑器的功能。开发者可以通过 ExtensionPack 自定义素材类型、轨道管理器、编辑面板等，从而实现对 WebCut 的深度定制和功能扩展。

## 2. ExtensionPack 核心接口

ExtensionPack 的核心是 `WebCutExtensionPack` 接口，定义在 `/src/types/index.ts` 文件中。该接口包含以下主要部分：

```typescript
export interface WebCutExtensionPack {
    /** 素材配置 */
    materialConfig?: {
        /** 在素材库中进行注册 */
        name: string;
        /** 素材库顶部、规定左侧显示的图标 */
        icon: Component;
        /** 显示名 */
        displayName: string;
        /** 素材类型，用于在push到canvas中时用来进行判断的标识 */
        materialType: WebCutMaterialType;
        /**
         * 资源类型，用于控制rail中应该保持同一素材
         * 需要注意，一种thingType，只能被注册一次，且不可以注册内置的4种type
         */
        thingType: WebCutThingType;
        /** 素材库组件 */
        libraryComponent: Component;
    };
    /** 素材库配置 */
    libraryConfig?: {
        /** 在素材库中注册新的导航项 */
        navs: {
            /** 目标素材，可以是自定义的素材 */
            targetThing: WebCutThingType;
            /** 插入位置 */
            insertBeforeIndex: number;
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** 轨道管理器配置 */
    managerConfig?: {
        /** 是否满足条件，在manager中使用本模块 */
        is: (rail: WebCutRail) => boolean;
        /** 轨道高度，根据类型不同而不同 */
        height?: number;
        segment?: {
            /** 是否禁用时间轴调整 */
            disableChangeTiming?: boolean;
            component?: Component;
        },
        aside?: {
            component?: Component;
            // 是否开启下面这些功能，默认不开启
            lock?: boolean;
            hide?: boolean;
            mute?: boolean;
        },
    };
    /** 右侧编辑面板 */
    panelConfig?: {
        tabs?: {
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** 语言包 */
    languagePackages?: Record<string, Record<string, string>>;
    /** 初始化模块 */
    onRegister(context: WebCutContext): Promise<void>;
    /** 素材被push到轨道上时调用 */
    onPush(source: WebCutSource): Promise<void>;
    /** 在push新轨道时，对轨道排序进行二次处理 */
    onSortRails(rails: WebCutRail[]): WebCutRail[];
}
```

## 3. 创建 ExtensionPack

### 3.1 基本结构

创建一个 ExtensionPack 需要实现 `WebCutExtensionPack` 接口，通常采用类的形式：

```typescript
import { defineComponent } from 'vue';
import { WebCutExtensionPack, WebCutContext, WebCutSource, WebCutRail } from 'webcut';

// 自定义图标组件
const CustomIcon = defineComponent({
  render() {
    return <div>自定义图标</div>;
  }
});

// 自定义素材库组件
const CustomLibraryComponent = defineComponent({
  render() {
    return <div>自定义素材库</div>;
  }
});

export class CustomExtensionPack implements WebCutExtensionPack {
  // 素材配置
  materialConfig = {
    name: 'custom',
    icon: CustomIcon,
    displayName: '自定义素材',
    materialType: 'custom',
    thingType: 'custom',
    libraryComponent: CustomLibraryComponent
  };

  // 轨道管理器配置
  managerConfig = {
    is: (rail: WebCutRail) => rail.type === 'custom',
    height: 80,
    segment: {
      disableChangeTiming: false
    },
    aside: {
      lock: true,
      hide: true,
      mute: false
    }
  };

  // 初始化模块
  async onRegister(context: WebCutContext): Promise<void> {
    console.log('CustomExtensionPack 已注册');
  }

  // 素材被push到轨道上时调用
  async onPush(source: WebCutSource): Promise<void> {
    console.log('自定义素材被添加到轨道', source);
  }

  // 在push新轨道时，对轨道排序进行二次处理
  onSortRails(rails: WebCutRail[]): WebCutRail[] {
    return rails;
  }
}
```

### 3.2 接口详解

#### 3.2.1 materialConfig

用于配置自定义素材类型，包括：
- `name`: 素材名称，用于内部标识
- `icon`: 素材库中显示的图标组件
- `displayName`: 素材显示名称
- `materialType`: 素材类型，用于在push到canvas时进行判断
- `thingType`: 资源类型，用于控制轨道中应该保持同一素材类型，每个thingType只能注册一次
- `libraryComponent`: 素材库组件，用于展示和管理该类型的素材

#### 3.2.2 libraryConfig

用于配置素材库导航项，包括：
- `navs`: 导航项数组，每个导航项包含目标素材类型、插入位置、键、标签和组件

#### 3.2.3 managerConfig

用于配置轨道管理器，包括：
- `is`: 判断函数，用于确定当前轨道是否使用该模块
- `height`: 轨道高度
- `segment`: 片段配置，包括是否禁用时间轴调整和自定义组件
- `aside`: 侧边栏配置，包括自定义组件和是否开启锁定、隐藏、静音功能

#### 3.2.4 panelConfig

用于配置右侧编辑面板，包括：
- `tabs`: 标签页数组，每个标签页包含键、标签和组件

#### 3.2.5 languagePackages

用于提供多语言支持，格式为 `Record<string, Record<string, string>>`，其中键为语言代码，值为翻译键值对。

#### 3.2.6 onRegister

模块注册时调用的初始化函数，接收 `WebCutContext` 参数，可以在这里进行初始化操作。

#### 3.2.7 onPush

素材被添加到轨道时调用的函数，接收 `WebCutSource` 参数，可以在这里处理素材添加后的逻辑。

#### 3.2.8 onSortRails

在添加新轨道时调用的轨道排序函数，接收轨道数组，返回排序后的轨道数组。

## 4. 注册 ExtensionPack

创建好 ExtensionPack 后，需要通过 `registerExtensionPack` 函数进行注册：

```typescript
import { useWebCutContext } from 'webcut';
import { CustomExtensionPack } from './CustomExtensionPack';

const { registerExtensionPack } = useWebCutContext();

// 注册 ExtensionPack
registerExtensionPack(CustomExtensionPack);
```

## 5. ExtensionPack 应用场景

### 5.1 自定义素材类型

通过 ExtensionPack 可以添加自定义的素材类型，例如：
- 3D 模型素材
- 图表素材
- 特殊效果素材

### 5.2 自定义轨道管理器

可以为不同类型的素材定制轨道管理器，包括：
- 自定义轨道高度
- 自定义片段显示方式
- 自定义侧边栏功能

### 5.3 自定义编辑面板

可以为自定义素材类型添加专属的编辑面板，提供特定的编辑功能。

### 5.4 多语言支持

可以通过 ExtensionPack 为编辑器添加新的语言支持。

## 6. 完整示例

以下是一个完整的 ExtensionPack 示例，用于添加一个自定义的图表素材类型：

```typescript
import { defineComponent, h } from 'vue';
import { WebCutExtensionPack, WebCutContext, WebCutSource, WebCutRail } from 'webcut';

// 图表图标组件
const ChartIcon = defineComponent({
  render() {
    return h('svg', {
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2'
    }, [
      h('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
      h('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
      h('line', { x1: '6', y1: '20', x2: '6', y2: '14' })
    ]);
  }
});

// 图表素材库组件
const ChartLibraryComponent = defineComponent({
  setup() {
    const charts = [
      { id: 'chart1', name: '柱状图', type: 'bar' },
      { id: 'chart2', name: '折线图', type: 'line' },
      { id: 'chart3', name: '饼图', type: 'pie' }
    ];

    return () => h('div', {
      class: 'chart-library'
    }, charts.map(chart => h('div', {
      class: 'chart-item',
      onClick: () => {
        // 处理添加图表到轨道的逻辑
        console.log('添加图表:', chart);
      }
    }, chart.name)));
  }
});

// 图表编辑面板组件
const ChartPanelComponent = defineComponent({
  props: ['source'],
  setup(props) {
    return () => h('div', {
      class: 'chart-panel'
    }, [
      h('h3', '图表编辑'),
      h('div', `图表类型: ${props.source?.meta?.chartType}`)
    ]);
  }
});

export class ChartExtensionPack implements WebCutExtensionPack {
  // 素材配置
  materialConfig = {
    name: 'chart',
    icon: ChartIcon,
    displayName: '图表素材',
    materialType: 'chart',
    thingType: 'chart',
    libraryComponent: ChartLibraryComponent
  };

  // 轨道管理器配置
  managerConfig = {
    is: (rail: WebCutRail) => rail.type === 'chart',
    height: 100,
    segment: {
      disableChangeTiming: false
    },
    aside: {
      lock: true,
      hide: true,
      mute: false
    }
  };

  // 右侧编辑面板配置
  panelConfig = {
    tabs: [
      {
        key: 'chart',
        label: '图表',
        component: ChartPanelComponent
      }
    ]
  };

  // 语言包
  languagePackages = {
    'zh-CN': {
      'chart.material.name': '图表素材',
      'chart.panel.title': '图表编辑'
    },
    'en-US': {
      'chart.material.name': 'Chart Material',
      'chart.panel.title': 'Chart Edit'
    }
  };

  // 初始化模块
  async onRegister(context: WebCutContext): Promise<void> {
    console.log('ChartExtensionPack 已注册');
  }

  // 素材被push到轨道上时调用
  async onPush(source: WebCutSource): Promise<void> {
    console.log('图表素材被添加到轨道', source);
    // 可以在这里初始化图表数据
    if (!source.meta) {
      source.meta = {};
    }
    source.meta.chartType = 'bar';
  }

  // 在push新轨道时，对轨道排序进行二次处理
  onSortRails(rails: WebCutRail[]): WebCutRail[] {
    // 将图表轨道放在视频轨道之后
    const videoRails = rails.filter(r => r.type === 'video');
    const chartRails = rails.filter(r => r.type === 'chart');
    const otherRails = rails.filter(r => r.type !== 'video' && r.type !== 'chart');
    
    return [...videoRails, ...chartRails, ...otherRails];
  }
}
```

## 7. 注意事项

1. **thingType 唯一性**：每个 ExtensionPack 的 `thingType` 必须唯一，不能与内置类型（'video', 'audio', 'image', 'text'）或其他 ExtensionPack 的 `thingType` 重复。

2. **异步处理**：`onRegister` 和 `onPush` 方法都是异步的，需要正确处理异步操作。

3. **性能考虑**：在实现 ExtensionPack 时，应注意性能问题，避免在关键路径上执行耗时操作。

4. **类型安全**：使用 TypeScript 可以提供更好的类型检查和开发体验，建议始终使用 TypeScript 开发 ExtensionPack。

## 8. 总结

ExtensionPack 是 WebCut 视频编辑器的强大扩展机制，允许开发者通过实现特定接口来自定义和扩展编辑器的功能。通过 ExtensionPack，开发者可以添加新的素材类型、自定义轨道管理器、编辑面板等，从而实现对 WebCut 的深度定制。

希望本指南能帮助开发者快速上手 ExtensionPack 的开发，为 WebCut 视频编辑器添加更多丰富的功能。
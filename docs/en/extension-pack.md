# Extension Pack

## 1. Overview

ExtensionPack is an extension mechanism provided by the WebCut video editor, allowing developers to extend the editor's functionality by implementing specific interfaces. Developers can customize material types, track managers, editing panels, etc., through ExtensionPack, thereby achieving deep customization and functional extension of WebCut.

## 2. ExtensionPack Core Interface

The core of ExtensionPack is the `WebCutExtensionPack` interface, defined in the `/src/types/index.ts` file. This interface includes the following main parts:

```typescript
export interface WebCutExtensionPack {
    /** Material configuration */
    materialConfig?: {
        /** Register in the material library */
        name: string;
        /** Icon displayed at the top of the material library and on the left side of the rules */
        icon: Component;
        /** Display name */
        displayName: string;
        /** Material type, used to determine when pushing to canvas */
        materialType: WebCutMaterialType;
        /**
         * Resource type, used to control that the same material should be maintained in the rail
         * Note: A thingType can only be registered once and cannot be one of the built-in 4 types
         */
        thingType: WebCutThingType;
        /** Material library component */
        libraryComponent: Component;
    };
    /** Material library configuration */
    libraryConfig?: {
        /** Register new navigation items in the material library */
        navs: {
            /** Target material, can be a custom material */
            targetThing: WebCutThingType;
            /** Insert position */
            insertBeforeIndex: number;
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** Track manager configuration */
    managerConfig?: {
        /** Whether the condition is met to use this module in the manager */
        is: (rail: WebCutRail) => boolean;
        /** Track height, varies by type */
        height?: number;
        segment?: {
            /** Whether to disable timeline adjustment */
            disableChangeTiming?: boolean;
            component?: Component;
        },
        aside?: {
            component?: Component;
            // Whether to enable the following functions, disabled by default
            lock?: boolean;
            hide?: boolean;
            mute?: boolean;
        },
    };
    /** Right-side editing panel */
    panelConfig?: {
        tabs?: {
            key: string;
            label: string;
            component: Component;
        }[];
    };
    /** Language packages */
    languagePackages?: Record<string, Record<string, string>>;
    /** Initialize the module */
    onRegister(context: WebCutContext): Promise<void>;
    /** Called when material is pushed to the track */
    onPush(source: WebCutSource): Promise<void>;
    /** Secondary processing of track sorting when pushing a new track */
    onSortRails(rails: WebCutRail[]): WebCutRail[];
}
```

## 3. Creating an ExtensionPack

### 3.1 Basic Structure

Creating an ExtensionPack requires implementing the `WebCutExtensionPack` interface, usually in the form of a class:

```typescript
import { defineComponent } from 'vue';
import { WebCutExtensionPack, WebCutContext, WebCutSource, WebCutRail } from 'webcut';

// Custom icon component
const CustomIcon = defineComponent({
  render() {
    return <div>Custom Icon</div>;
  }
});

// Custom material library component
const CustomLibraryComponent = defineComponent({
  render() {
    return <div>Custom Library</div>;
  }
});

export class CustomExtensionPack implements WebCutExtensionPack {
  // Material configuration
  materialConfig = {
    name: 'custom',
    icon: CustomIcon,
    displayName: 'Custom Material',
    materialType: 'custom',
    thingType: 'custom',
    libraryComponent: CustomLibraryComponent
  };

  // Track manager configuration
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

  // Initialize the module
  async onRegister(context: WebCutContext): Promise<void> {
    console.log('CustomExtensionPack registered');
  }

  // Called when material is pushed to the track
  async onPush(source: WebCutSource): Promise<void> {
    console.log('Custom material added to track', source);
  }

  // Secondary processing of track sorting when pushing a new track
  onSortRails(rails: WebCutRail[]): WebCutRail[] {
    return rails;
  }
}
```

### 3.2 Interface Details

#### 3.2.1 materialConfig

Used to configure custom material types, including:
- `name`: Material name, used for internal identification
- `icon`: Icon component displayed in the material library
- `displayName`: Material display name
- `materialType`: Material type, used to determine when pushing to canvas
- `thingType`: Resource type, used to control that the same material type should be maintained in the track; each thingType can only be registered once
- `libraryComponent`: Material library component, used to display and manage this type of material

#### 3.2.2 libraryConfig

Used to configure material library navigation items, including:
- `navs`: Array of navigation items, each navigation item includes target material type, insertion position, key, label, and component

#### 3.2.3 managerConfig

Used to configure the track manager, including:
- `is`: Judgment function, used to determine whether the current track uses this module
- `height`: Track height
- `segment`: Segment configuration, including whether to disable timeline adjustment and custom components
- `aside`: Sidebar configuration, including custom components and whether to enable lock, hide, and mute functions

#### 3.2.4 panelConfig

Used to configure the right-side editing panel, including:
- `tabs`: Array of tab pages, each tab page includes key, label, and component

#### 3.2.5 languagePackages

Used to provide multi-language support, in the format of `Record<string, Record<string, string>>`, where the key is the language code and the value is the translation key-value pairs.

#### 3.2.6 onRegister

Initialization function called when the module is registered, receives `WebCutContext` parameter, can perform initialization operations here.

#### 3.2.7 onPush

Function called when material is added to the track, receives `WebCutSource` parameter, can handle logic after material is added here.

#### 3.2.8 onSortRails

Track sorting function called when adding a new track, receives the track array and returns the sorted track array.

## 4. Registering an ExtensionPack

After creating the ExtensionPack, it needs to be registered through the `registerExtensionPack` function:

```typescript
import { useWebCutContext } from 'webcut';
import { CustomExtensionPack } from './CustomExtensionPack';

const { registerExtensionPack } = useWebCutContext();

// Register the ExtensionPack
registerExtensionPack(CustomExtensionPack);
```

## 5. ExtensionPack Application Scenarios

### 5.1 Custom Material Types

Custom material types can be added through ExtensionPack, such as:
- 3D model materials
- Chart materials
- Special effect materials

### 5.2 Custom Track Managers

Track managers can be customized for different types of materials, including:
- Custom track height
- Custom segment display method
- Custom sidebar functions

### 5.3 Custom Editing Panels

Exclusive editing panels can be added for custom material types, providing specific editing functions.

### 5.4 Multi-language Support

New language support can be added to the editor through ExtensionPack.

## 6. Complete Example

The following is a complete ExtensionPack example for adding a custom chart material type:

```typescript
import { defineComponent, h } from 'vue';
import { WebCutExtensionPack, WebCutContext, WebCutSource, WebCutRail } from 'webcut';

// Chart icon component
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

// Chart material library component
const ChartLibraryComponent = defineComponent({
  setup() {
    const charts = [
      { id: 'chart1', name: 'Bar Chart', type: 'bar' },
      { id: 'chart2', name: 'Line Chart', type: 'line' },
      { id: 'chart3', name: 'Pie Chart', type: 'pie' }
    ];

    return () => h('div', {
      class: 'chart-library'
    }, charts.map(chart => h('div', {
      class: 'chart-item',
      onClick: () => {
        // Handle adding chart to track logic
        console.log('Adding chart:', chart);
      }
    }, chart.name)));
  }
});

// Chart editing panel component
const ChartPanelComponent = defineComponent({
  props: ['source'],
  setup(props) {
    return () => h('div', {
      class: 'chart-panel'
    }, [
      h('h3', 'Chart Editing'),
      h('div', `Chart Type: ${props.source?.meta?.chartType}`)
    ]);
  }
});

export class ChartExtensionPack implements WebCutExtensionPack {
  // Material configuration
  materialConfig = {
    name: 'chart',
    icon: ChartIcon,
    displayName: 'Chart Material',
    materialType: 'chart',
    thingType: 'chart',
    libraryComponent: ChartLibraryComponent
  };

  // Track manager configuration
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

  // Right-side editing panel configuration
  panelConfig = {
    tabs: [
      {
        key: 'chart',
        label: 'Chart',
        component: ChartPanelComponent
      }
    ]
  };

  // Language packages
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

  // Initialize the module
  async onRegister(context: WebCutContext): Promise<void> {
    console.log('ChartExtensionPack registered');
  }

  // Called when material is pushed to the track
  async onPush(source: WebCutSource): Promise<void> {
    console.log('Chart material added to track', source);
    // Initialize chart data here
    if (!source.meta) {
      source.meta = {};
    }
    source.meta.chartType = 'bar';
  }

  // Secondary processing of track sorting when pushing a new track
  onSortRails(rails: WebCutRail[]): WebCutRail[] {
    // Place chart tracks after video tracks
    const videoRails = rails.filter(r => r.type === 'video');
    const chartRails = rails.filter(r => r.type === 'chart');
    const otherRails = rails.filter(r => r.type !== 'video' && r.type !== 'chart');
    
    return [...videoRails, ...chartRails, ...otherRails];
  }
}
```

## 7. Notes

1. **thingType Uniqueness**: Each ExtensionPack's `thingType` must be unique and cannot duplicate built-in types ('video', 'audio', 'image', 'text') or other ExtensionPack's `thingType`.

2. **Asynchronous Processing**: The `onRegister` and `onPush` methods are asynchronous and need to handle asynchronous operations correctly.

3. **Performance Considerations**: When implementing ExtensionPack, attention should be paid to performance issues to avoid time-consuming operations on critical paths.

4. **Type Safety**: Using TypeScript can provide better type checking and development experience; it is recommended to always use TypeScript to develop ExtensionPack.

## 8. Summary

ExtensionPack is a powerful extension mechanism of the WebCut video editor, allowing developers to customize and extend the editor's functionality by implementing specific interfaces. Through ExtensionPack, developers can add new material types, customize track managers, editing panels, etc., thereby achieving deep customization of WebCut.

We hope this guide helps developers quickly get started with ExtensionPack development and add more rich features to the WebCut video editor.
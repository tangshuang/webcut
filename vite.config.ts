import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const allDependencies = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
];

// 根据环境变量选择构建配置
// webcomponents | esm | webcomponents_bundle | react
// 默认为esm
const buildType = process.env.BUILD_TYPE || 'esm';

// react 构建：将 vue / naive-ui / veaury 及全部实现打进产物，
// 仅把 react / react-dom 作为 peer 依赖 external（由宿主 React 应用提供）
const reactExternals = [/^react$/, /^react\/.*$/, /^react-dom$/, /^react-dom\/.*$/];

// 导出配置
export default defineConfig(({ mode }) => ({
  // examples 以「外部宿主」视角裸导入 webcut（webcut / webcut/webcomponents / webcut/react），
  // 本仓库既无自链接也无 exports 自引用，dev 下别名到源码入口（免先构建、支持 HMR）。
  // 产物 style.css 在 dev 下无需导入：组件样式由 vue 插件从 SFC 自动注入，别名到空占位。
  resolve: {
    alias: [
      { find: /^webcut\/(esm|webcomponents|react)\/style\.css$/, replacement: resolve(__dirname, 'examples/dev-noop.css') },
      { find: /^webcut\/webcomponents$/, replacement: resolve(__dirname, 'src/webcomponents.ts') },
      { find: /^webcut\/react$/, replacement: resolve(__dirname, 'src/react.ts') },
      { find: /^webcut$/, replacement: resolve(__dirname, 'src/index.ts') },
    ],
  },
  plugins: [
    vue(),
    buildType === 'esm' ? dts({
      insertTypesEntry: true,
      cleanVueFileName: true,
      copyDtsFiles: false,
      include: ['src/**/*'],
      exclude: [
        'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.md',
        'src/webcomponents.ts',
      ],
    }) : undefined,
    // react 入口的类型声明：输出完整类型树（排除两个 Vue 入口，避免 index.d.ts 冲突），
    // 构建后由 package.json 的 rename 后处理把 react/react.d.ts 改名为 index.d.ts
    buildType === 'react' ? dts({
      insertTypesEntry: false,
      cleanVueFileName: true,
      copyDtsFiles: false,
      include: ['src/**/*'],
      exclude: [
        'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.md',
        'src/index.ts',
        'src/webcomponents.ts',
      ],
    }) : undefined,
  ].filter(Boolean),
  define: buildType.endsWith('_bundle') ? {
    'process.env.NODE_ENV': JSON.stringify(mode),
  } : undefined,
  build: {
    lib: {
      entry: buildType.startsWith('webcomponents') ? resolve(__dirname, 'src/webcomponents.ts')
        : buildType === 'react' ? resolve(__dirname, 'src/react.ts')
        : resolve(__dirname, 'src/index.ts'),
      name: 'WebCut',
      fileName: () => 'index.js',
      formats: [buildType.endsWith('_bundle') ? 'iife' : 'es'],
    },
    sourcemap: true,
    minify: buildType.endsWith('_bundle'),
    outDir: {
      webcomponents: 'webcomponents',
      webcomponents_bundle: 'webcomponents/bundle',
      react: 'react',
      esm: 'esm',
    }[buildType],
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: buildType === 'react'
        ? reactExternals
        : buildType.endsWith('_bundle') ? [] : allDependencies,
      output: {
        // IIFE bundle 不支持代码分割；动态导入内联（其余构建保持多 chunk）
        inlineDynamicImports: buildType.endsWith('_bundle'),
        manualChunks: buildType.startsWith('webcomponents') ? undefined : (id) => {
          if (id.includes('ffmpeg.wasm/ffmpeg-core.js')) {
            return 'ffmpeg.wasm-core';
          }
          else if (id.includes('ffmpeg.wasm/ffmpeg.worker.js')) {
            return 'ffmpeg.wasm-worker';
          }
          else if (id.includes('ffmpeg.wasm/ffmpeg-core.wasm')) {
            return 'ffmpeg.wasm-wasm';
          }
          return null;
        },
      },
    },
  },
}));

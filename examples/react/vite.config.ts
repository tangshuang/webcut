import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';

// webcut/react 产物内含 Vue 组件（veaury 桥），dev 下直接引用源码时需要 vue 插件处理 .vue；
// 本示例引用构建产物（webcut/react），两个插件按需加载各自文件类型
export default defineConfig({
  plugins: [react()],
});

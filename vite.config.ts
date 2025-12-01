import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const allDependencies = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      cleanVueFileName: true,
      copyDtsFiles: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.md'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebCut',
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: allDependencies,
    },
    sourcemap: true,
    outDir: 'esm',
  },
});
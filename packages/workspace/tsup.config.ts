import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  // 將 workspace 依賴的 @runflow/* 一併打包，避免執行時從 workspace 目錄解析
  // 導致 flow-viewer 等 app 在載入 workspace dist 時找不到 @runflow/core
  noExternal: [/^@runflow\//],
})

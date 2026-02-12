import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  external: ['@runflow/config', '@runflow/convention-openapi', '@runflow/core', '@runflow/handlers'],
})

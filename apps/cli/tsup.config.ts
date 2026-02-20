import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  external: ['@runflow/convention-openapi', '@runflow/core', '@runflow/handlers', '@runflow/workspace', 'yaml'],
})

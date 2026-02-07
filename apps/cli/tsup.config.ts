import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  noExternal: ['@runflow/core'],
  external: ['yaml'],
})

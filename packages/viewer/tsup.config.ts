import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'server/lib/index': 'server/lib/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: false, // Don't clean dist because vite build also puts things there
  minify: false,
  sourcemap: true,
  external: [
    '@runflow/core',
    '@runflow/workspace',
    '@runflow/handlers',
    '@runflow/convention-openapi',
    'polka',
    'sirv',
    'ws',
    'vite',
    'express',
  ],
})

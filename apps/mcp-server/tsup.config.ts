import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  external: ['@apidevtools/swagger-parser', '@modelcontextprotocol/sdk', 'commander', 'yaml', 'zod'],
})

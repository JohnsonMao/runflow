import type { PluginOption } from 'vite'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { workspaceApiPlugin } from './vite-plugin-workspace-api'

export default defineConfig({
  plugins: [tailwindcss(), react(), workspaceApiPlugin()] as PluginOption[],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
  },
})

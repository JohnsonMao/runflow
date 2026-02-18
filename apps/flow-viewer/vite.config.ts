import type { PluginOption } from 'vite'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { workspaceApiPlugin } from './src/vite-plugin-workspace-api'

/** Monorepo 根目錄，用於從根目錄載入 .env */
const rootDir = path.resolve(__dirname, '../..')

export default defineConfig(({ mode }) => {
  // 在 config 執行時手動載入根目錄 .env，讓 plugin 內 process.env 能讀到
  const env = loadEnv(mode, rootDir, '')
  Object.assign(process.env, env)

  return {
    envDir: rootDir,
    plugins: [tailwindcss(), react(), workspaceApiPlugin()] as PluginOption[],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'dist',
    },
  }
})

import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** Monorepo 根目錄，用於從根目錄載入 .env */
const rootDir = path.resolve(__dirname, '../..')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  Object.assign(process.env, env)

  return {
    envDir: rootDir,
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'dist',
    },
  }
})

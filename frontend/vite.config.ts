import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/analytics': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3111',
        changeOrigin: true,
      },
    },
  },
})

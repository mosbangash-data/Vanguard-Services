import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BUILD_VERSION = process.env.GIT_COMMIT || process.env.VITE_BUILD_VERSION || 'development'

export default defineConfig({
  base: '/admin/',
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

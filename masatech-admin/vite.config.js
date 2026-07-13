import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Production build is served by api/src/app.js under /admin (see storagePaths-style
  // static serving there) -- asset URLs must resolve relative to that path.
  base: '/admin/',
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})

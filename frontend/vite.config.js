import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/**/*', 'vite.svg'],
      manifest: false, // Use existing public/manifest.json
      workbox: {
        // Don't cache API calls - always fetch fresh data
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.onrender\.com\/api\/.*/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|webp|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    base: '/',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@chakra-ui/react', '@chakra-ui/icons', '@emotion/react', '@emotion/styled', 'framer-motion']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://homeschoollms-server.onrender.com',
        changeOrigin: true,
        secure: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  }
})
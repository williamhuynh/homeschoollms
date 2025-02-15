import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    base: '/' // Add this line
  },
  server: {
    port: 3000  // Keep your local development port
  }
})
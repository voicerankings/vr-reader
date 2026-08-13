import { defineConfig } from 'vite'
import autoprefixer from 'autoprefixer'
import tailwind from 'tailwindcss'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'

import manifest from './manifest.json' assert { type: 'json' } // Node >=17
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()],
    },
  },
  build: {
    target: ['esnext'] // Use 'esnext' or a version that supports top-level await
  },
    plugins: [
        vue(),
        crx({ manifest })
    ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
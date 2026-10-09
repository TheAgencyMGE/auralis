import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
    build: {
      // Readability is inlined as source text (?raw) for injection into pages.
      externalizeDeps: { exclude: ['@mozilla/readability'] },
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    }
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    build: {
      // Sandboxed preloads cannot require() local files, so there is exactly
      // one preload entry and it bundles everything it needs.
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].js', inlineDynamicImports: true }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    base: '/',
    resolve: { alias: { '@shared': shared, '@ui': resolve(__dirname, 'src/renderer/ui') } },
    plugins: [react()],
    server: { hmr: { host: 'localhost' } },
    build: {
      target: 'chrome150',
      rollupOptions: {
        input: {
          chrome: resolve(__dirname, 'src/renderer/chrome/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          page: resolve(__dirname, 'src/renderer/page/index.html')
        }
      }
    }
  }
})

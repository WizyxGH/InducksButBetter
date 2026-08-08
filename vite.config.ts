import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const logger = createLogger()
const originalError = logger.error
logger.error = (msg, options) => {
  // Silence specific proxy errors when the local backend isn't running
  if (msg.includes('http proxy error') && msg.includes('/api/proxy-image')) return
  originalError(msg, options)
}

// https://vitejs.dev/config/
export default defineConfig({
  customLogger: logger,
  base: '/InducksButBetter/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon.svg', 'ogimage.jpg'],
      manifest: {
        name: 'InducksButBetter',
        short_name: 'InducksButBetter',
        description: 'Find exactly what you are looking for in the Inducks database',
        theme_color: '#2563eb',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/InducksButBetter/',
        start_url: '/InducksButBetter/',
        // PNG before SVG: Android picks the first usable entry and its SVG
        // support is uneven. 192 and 512 are the two sizes Chrome asks for.
        // The maskable variant is a separate file — Android crops maskable
        // icons to a circle 80% of the canvas, so its logo is shrunk to fit
        // inside that safe zone instead of losing its wingtips.
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        categories: ['entertainment', 'reference', 'utilities'],
      },
      workbox: {
        // Precache the app shell (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Don't precache large assets like the DB, WASM, or AI bundles
        globIgnores: ['**/inducks.db', '**/sql-wasm.wasm', '**/ogvideo.webm', '**/ai-vendor-*.js', '**/webllmWorker-*.js'],
        // Allow larger chunks (AI vendor bundles exceed the default 2MB limit)
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MB
        // Runtime caching strategies for dynamic content
        runtimeCaching: [
          {
            // Cache cover images and thumbnails from Inducks CDN
            urlPattern: /^https:\/\/.*inducks\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'inducks-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Network-first for API calls
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache locale files for offline i18n
            urlPattern: /\/locales\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'locale-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
        ],
        // Skip waiting so the new SW activates immediately
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 500,
        proxyTimeout: 500,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            if (res && typeof res === 'object' && 'headersSent' in res && 'writeHead' in res && typeof res.writeHead === 'function') {
              const serverResponse = res as import('http').ServerResponse;
              if (!serverResponse.headersSent) {
                serverResponse.writeHead(502, { 'Content-Type': 'text/plain' });
                serverResponse.end('Proxy error: ' + (err as any).code);
              }
            }
          });
        }
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Match on package boundaries, never on a bare substring: `react`
          // appears in `@radix-ui/react-*`, `lucide-react`, `react-day-picker`
          // and `@uiw/react-codemirror`, so a substring test dragged the whole
          // UI toolkit into the eagerly loaded react chunk.
          const pkg = id.split('node_modules/').pop()?.replace(/^\.pnpm\/[^/]+\/node_modules\//, '') ?? ''
          const name = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]

          // The AI assistant is several megabytes and only reachable from the
          // SQL tab, so it must stay in its own lazily fetched chunk.
          if (name.startsWith('@mlc-ai') || name === 'web-llm') return 'ai-vendor'

          // The SQL editor is lazy-loaded too; keep its editor engine with it.
          if (name.startsWith('@codemirror') || name.startsWith('@lezer') || name === '@uiw/react-codemirror' || name === 'codemirror') {
            return 'editor-vendor'
          }

          if (name === 'react' || name === 'react-dom' || name === 'scheduler') return 'react-vendor'

          if (name.startsWith('@radix-ui') || name === 'lucide-react' || name === 'cmdk' ||
              name === 'class-variance-authority' || name === 'clsx' || name === 'tailwind-merge') {
            return 'ui-vendor'
          }

          return 'vendor'
        }
      }
    }
  }
})

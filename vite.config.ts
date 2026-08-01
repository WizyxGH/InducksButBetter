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
      includeAssets: ['favicon.ico', 'pwa-icon.svg', 'pwa-icon-512.jpg', 'ogimage.jpg'],
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
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable',
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
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }
            if (id.includes('@libsql') || id.includes('hrana')) {
              return 'db-vendor';
            }
            if (id.includes('@mlc-ai') || id.includes('web-llm')) {
              return 'ai-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})

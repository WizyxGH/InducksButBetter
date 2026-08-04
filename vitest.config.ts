import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      // `scratch/` holds throwaway probes that hit the local 1 GB SQLite
      // snapshot; they must never be part of the suite.
      exclude: ['**/node_modules/**', '**/dist/**', 'scratch/**'],
    },
  })
)

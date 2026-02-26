import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Cast needed: vite-plugin-solid returns vite.Plugin which is incompatible with
// vitest's bundled vite.Plugin due to differing vite versions (hotUpdate types).
export default defineConfig({
  plugins: [solid({ dev: false, hot: false }) as never],
  test: {
    environment: 'jsdom',
    /* for example, use global to avoid globals imports (describe, test, expect): */
    // globals: true,
    setupFiles: ['./test/helpers/equalsWithEpsilon.ts'],
  },
})

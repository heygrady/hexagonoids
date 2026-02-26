import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid({ dev: false, hot: false })],
  test: {
    environment: 'jsdom',
    /* for example, use global to avoid globals imports (describe, test, expect): */
    // globals: true,
    setupFiles: [
      './test/helpers/setupTests.ts',
      './test/helpers/equalsWithEpsilon.ts',
    ],
  },
})

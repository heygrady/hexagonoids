import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [solid({ dev: false, hot: false }) as any],
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

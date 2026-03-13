/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['browser', 'solid'],
  },
  ssr: {
    resolve: {
      conditions: ['browser', 'solid'],
    },
  },
  test: {
    // ...
  },
  bench: {
    // ...
  },
})

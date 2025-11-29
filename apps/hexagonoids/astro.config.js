import path from 'node:path'

import solid from '@astrojs/solid-js'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/static'
import { defineConfig } from 'astro/config'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://astro.build/config
export default defineConfig({
  integrations: [solid(), tailwind()],
  adapter: vercel({
    analytics: true,
  }),
  vite: {
    optimizeDeps: {
      include: ['async-sema'],
      exclude: [
        '@neat-evolution/worker-actions',
        '@neat-evolution/worker-evaluator',
        '@neat-evolution/worker-pool',
        '@neat-evolution/worker-reproducer',
        '@neat-evolution/worker-threads',
        '@neat-evolution/neat',
        '@neat-evolution/cppn',
        '@neat-evolution/hyperneat',
        '@neat-evolution/es-hyperneat',
        '@neat-evolution/des-hyperneat',
        '@neat-evolution/executor',
        '@heygrady/tictactoe-environment',
        '@heygrady/tictactoe-game',
      ],
    },
    plugins: [
      {
        ...nodePolyfills(),
        apply: 'serve', // Only apply in dev mode
      },
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Isolate worker modules from main app chunks
            // These modules are dynamically imported by web workers and must not
            // include browser-only code like Solid.js
            if (id.includes('/modules/') && id.includes('Pathname')) {
              const match = id.match(/modules\/([^/]+)\.ts/)
              if (match) {
                return `worker-${match[1]}`
              }
            }
            if (
              id.includes('@neat-evolution') ||
              id.includes('@heygrady/tictactoe') ||
              id.includes('@heygrady/tournament')
            ) {
              const getNeatId = (id) => {
                const match = id.match(/@(?:neat-evolution|heygrady)\/(.+)/)
                return match ? `neat-${match[1]}` : id
              }
              return getNeatId(id)
            }
          },
        },
      },
    },
    server: {
      fs: {
        allow: [
          path.resolve('../..'), // Repo root
        ],
      },
    },
  },
})

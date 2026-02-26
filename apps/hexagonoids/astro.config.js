import path from 'node:path'
import node from '@astrojs/node'
import solid from '@astrojs/solid-js'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [solid()],
  adapter: node({ mode: 'standalone' }),
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
    plugins: [tailwindcss()],
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
              id.includes('@heygrady/tournament') ||
              // Match local monorepo packages by folder path
              id.includes('/packages/tictactoe-') ||
              id.includes('/packages/tournament-strategy')
            ) {
              // Chunk by package name only (not per-file) to prevent
              // shared dependencies from contaminating worker chunks
              // Match npm package names OR local package folder names
              const match =
                id.match(/@(?:neat-evolution|heygrady)\/([^/]+)/) ||
                id.match(/\/packages\/(tictactoe-[^/]+|tournament-strategy)\//)
              return match ? `neat-${match[1]}` : null
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

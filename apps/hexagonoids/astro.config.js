import path from 'node:path'

import solid from '@astrojs/solid-js'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://astro.build/config
export default defineConfig({
  integrations: [solid()],
  adapter: vercel({
    analytics: true,
  }),
  vite: {
    optimizeDeps: {
      include: ['async-sema'],
      // Exclude packages used by web workers from Vite's dep optimizer.
      // Vite's optimizeDeps.exclude requires exact package names (no globs).
      // These must stay pre-bundled as ES modules so workers can import them.
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
        '@heygrady/hexagonoids-environment',
        '@heygrady/hexagonoids-engine',
      ],
    },
    plugins: [
      tailwindcss(),
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
            // Why manualChunks: Web workers dynamically import algorithm/environment
            // modules by URL at runtime (via extractModulePath parsing function.toString()
            // on import.meta.glob entries). Without manual chunking, SolidJS and other
            // browser-only code contaminates worker chunks, causing "s is not a function"
            // errors in production.
            //
            // Note: Using `?url` on glob imports was tried (6f478ca) and reverted (79d2ac7)
            // because Vite's `?url` produces static asset URLs, not importable ES module
            // chunk URLs that workers need.

            // Worker module entry points → dedicated chunks per component.
            // Both tictactoe and hexagonoids have identically-named module files
            // (e.g. CPPNAlgorithmPathname.ts). If they land in the same chunk,
            // Rollup namespace-wraps the exports and workers can't find
            // createConfig/createGenome as direct exports.
            if (id.includes('/modules/') && id.includes('Pathname')) {
              const match = id.match(
                /components\/([^/]+)\/.*?modules\/([^/]+)\.ts/
              )
              if (match) return `worker-${match[1]}-${match[2]}`
              const fallback = id.match(/modules\/([^/]+)\.ts/)
              if (fallback) return `worker-${fallback[1]}`
            }
            // All @neat-evolution npm packages → neat-* chunks
            if (id.includes('@neat-evolution/')) {
              const match = id.match(/@neat-evolution\/([^/]+)/)
              return match ? `neat-${match[1]}` : null
            }
            // All monorepo packages (packages/*) → neat-* chunks
            // This auto-detects any package added to packages/, no manual updates needed.
            if (id.includes('/packages/')) {
              const match = id.match(/\/packages\/([^/]+)\//)
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

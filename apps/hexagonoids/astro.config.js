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
    plugins: [nodePolyfills()],
    server: {
      fs: {
        allow: [
          path.resolve('../..'), // Repo root
          path.resolve('/Users/heygrady/projects/neat-js/packages/'),
        ],
      },
    },
  },
})

import solid from '@astrojs/solid-js'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/static'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  integrations: [solid(), tailwind()],
  adapter: vercel({
    analytics: true,
  }),
})

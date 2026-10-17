import viteHubNuxt from 'vite-hub/nuxt'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [viteHubNuxt],
  vitehub: { preset: 'node', database: true },
})

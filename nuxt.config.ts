import viteHubNuxt from 'vite-hub/nuxt'

export default defineNuxtConfig({
  modules: [viteHubNuxt],
  vitehub: { preset: 'node' },
  compatibilityDate: '2025-07-15',
})

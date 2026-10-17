import viteHubNuxt from 'vite-hub/nuxt'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: [viteHubNuxt],
  vitehub: { preset: 'cloudflare', blob: true },
  // The trigger. The cloudflare preset's default runner is workerd, where `cloudflare:workers` exists.
  nitro: { devServer: { runner: 'node-worker' } },
})

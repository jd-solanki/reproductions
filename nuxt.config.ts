export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  nitro: { preset: 'cloudflare_module' },
  routeRules: { '/': { prerender: true } },
})

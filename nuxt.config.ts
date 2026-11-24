export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/content'],
  content: {
    database: { type: 'd1', bindingName: 'DB' },
  },
  nitro: { preset: 'cloudflare_module' },
})

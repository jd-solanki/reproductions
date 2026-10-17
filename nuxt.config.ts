export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['vite-hub/nuxt'],
  vitehub: {
    preset: 'cloudflare',
    database: true,
  },
})


export default defineNuxtConfig({
  modules: ['vite-hub/nuxt'],
  vitehub: { preset: 'node', database: true },
  compatibilityDate: '2025-07-15',
})

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxthub/core', '@nuxtjs/better-auth'],
  hub: {
    db: 'sqlite',
  },
  // Served below another app on the same hostname, e.g. a marketing site at `/`.
  app: {
    baseURL: '/app/',
  },
})

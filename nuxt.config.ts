export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxthub/core', '@nuxtjs/better-auth'],
  hub: { db: 'sqlite' },
})

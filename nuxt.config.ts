export default defineNuxtConfig({
  modules: ['@nuxtjs/better-auth'],
  compatibilityDate: '2025-07-15',
  routeRules: {
    '/admin/**': { auth: 'user', robots: false },
  },
})

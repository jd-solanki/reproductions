// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/robots'],
  compatibilityDate: '2025-07-15',
  routeRules: {
    '/private': { robots: false },
  },
})

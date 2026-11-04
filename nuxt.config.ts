export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/mdc', '@nuxtjs/html-validator'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  // Validate only the rule this repro is about, and fail the build on it.
  htmlValidator: {
    failOnError: true,
    options: {
      extends: [],
      rules: { 'wcag/h63': 'error' },
    },
  },
  nitro: { prerender: { routes: ['/'] } },
})

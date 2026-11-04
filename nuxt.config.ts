export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/html-validator'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  // Registers UContentSearchButton without installing @nuxt/content.
  ui: { content: true },
  htmlValidator: {
    failOnError: true,
    // Only the rule this repro is about, so nothing else turns the build red.
    options: { extends: [], rules: { 'element-permitted-content': 'error' } },
  },
})

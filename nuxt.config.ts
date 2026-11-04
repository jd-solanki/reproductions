export default defineNuxtConfig({
  modules: ['@nuxtjs/mdc', '@nuxtjs/html-validator'],
  compatibilityDate: '2026-10-01',
  mdc: {
    highlight: { theme: 'github-light', langs: ['ts'] },
  },
  htmlValidator: {
    failOnError: true,
    // Only the rule this repro is about, so nothing else can turn the build red.
    options: { extends: [], rules: { 'element-permitted-content': 'error' } },
  },
})

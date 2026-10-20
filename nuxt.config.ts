export default defineNuxtConfig({
  modules: ['nuxt-seo-utils'],
  // Registers /__nuxt-seo-utils/debug.json outside dev too, as `nuxt dev` always does.
  seo: { debug: true },
  runtimeConfig: {
    public: { apiBase: '/api' },
  },
})

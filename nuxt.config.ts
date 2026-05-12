// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxthub/core'],
  hub: {
    db: 'sqlite',
  },
  imports: {
    dirs: [
      // Shared schemas of app & layers
      '../shared/schema/**',
      '../layers/*/shared/schema/**',
    ],
  },
})

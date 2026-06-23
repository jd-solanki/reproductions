// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxthub/core', '@onmax/nuxt-better-auth'],
  hub: { db: 'sqlite' },
  runtimeConfig: { public: { app: { routes: { signUp: '/auth/sign-up' } } } },
})

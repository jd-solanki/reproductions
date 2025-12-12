// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // NOTE: This doesn't work as you can check auth middleware runs before base middleware
  extends: [
    './layers/base/',
    './layers/auth/',
  ],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})

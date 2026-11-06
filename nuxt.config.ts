// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxtjs/better-auth'],
  // In dev this runs nitropack's cloudflare-dev plugin, which sets `event.node.req.__unenv__`.
  nitro: { preset: 'cloudflare_module' },
})

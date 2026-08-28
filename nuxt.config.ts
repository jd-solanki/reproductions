export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // The demo module is listed FIRST so its `better-auth:config:extend` listener is
  // attached before @nuxtjs/better-auth's setup() fires the hook.
  modules: ['./demo-module/index', '@nuxthub/core', '@nuxtjs/better-auth'],
  hub: { db: 'sqlite' },
})

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxthub/core', '@nuxtjs/better-auth'],
  hub: {
    db: 'sqlite',
    // `hubSecondaryStorage: true` refuses to boot without hub KV.
    kv: true,
  },
  auth: {
    // `true` is the configuration under test: the module writes the secondary
    // storage itself, into `.nuxt/better-auth/secondary-storage.mjs`.
    //
    // `'custom'` is the module's own documented escape hatch, and the repro's
    // two control steps switch to it. server/auth.config.ts then supplies a
    // storage that has all five methods better-auth 1.7 requires.
    hubSecondaryStorage: process.env.REPRO_STORAGE === 'custom' ? 'custom' : true,
  },
})

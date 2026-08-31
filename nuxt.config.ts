export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // Order matters here, and it is the ordinary order: NuxtHub first, because
  // `@nuxtjs/better-auth` is the module that plugs into it. That ordering is
  // what the bug turns on -- see README.md.
  modules: ['@nuxthub/core', '@nuxtjs/better-auth'],

  hub: {
    db: 'sqlite',
  },

  // Nothing about the auth options is under test. The module only needs enough
  // to resolve a server config and generate a schema, which server/auth.config.ts
  // supplies. `hubSecondaryStorage` is deliberately absent: that is a different
  // bug and does not belong in this repro.
})

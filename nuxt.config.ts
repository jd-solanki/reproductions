// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxthub/core'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Enable NuxtHub's Drizzle database. This generates the aggregated `@nuxthub/db`
  // package from `server/db/schema/**` (both `@nuxthub/db` and `@nuxthub/db/schema`).
  hub: {
    db: {
      dialect: 'postgresql',
      // Use the `postgres-js` driver — the production driver (e.g. Cloudflare Hyperdrive).
      // No DB connection is needed: the client build fails long before any query runs, so we
      // disable build-time migrations to keep the failure focused on the bundling error.
      driver: 'postgres-js',
      applyMigrationsDuringBuild: false,
    },
  },
})

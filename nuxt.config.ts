export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['nuxt-ai-ready'],
  site: {
    url: 'https://example.com',
    name: 'Repro',
  },
  // Control: install `drizzle-orm@1.0.0-rc.4`, uncomment the next line, and `pnpm repro` passes.
  // aiReady: { database: { type: 'sqlite' } },
})

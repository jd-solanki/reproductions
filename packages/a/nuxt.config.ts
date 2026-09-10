// The tip of the diamond. Every value in this repro is authored here, exactly once.
export default defineNuxtConfig({
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '0 0 * * *': ['someTask'] },

    // nitropack 2.x does not derive Cloudflare cron triggers from `scheduledTasks`,
    // so the wrangler `crons` array has to be written by hand.
    cloudflare: { wrangler: { triggers: { crons: ['0 0 * * *'] } } },

    // A second, unrelated array under `nitro.*`, to show the blast radius is the whole
    // `nitro` subtree rather than anything cron-specific.
    externals: { inline: ['some-package'] },
  },

  // A Nuxt-owned array, for contrast: Nuxt dedupes this one downstream.
  imports: { dirs: [new URL('utils', import.meta.url).pathname] },
})

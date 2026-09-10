// The tip of the diamond. Every cron in this repro is authored here, exactly once.
export default defineNuxtConfig({
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '0 0 * * *': ['someTask'] },

    // nitropack 2.x does not derive Cloudflare cron triggers from `scheduledTasks`,
    // so the wrangler `crons` array has to be written by hand.
    cloudflare: { wrangler: { triggers: { crons: ['0 0 * * *'] } } },
  },
})

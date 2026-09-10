// The second edge of the diamond. It contributes no cron of its own.
export default defineNuxtConfig({
  extends: [process.env.REPRO_EXTENDS === 'path' ? '../a' : '@repro/layer-a'],
})

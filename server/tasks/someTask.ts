export default defineTask({
  meta: { name: 'someTask', description: 'The one task the cron in packages/a schedules.' },
  run() {
    return { result: 'ok' }
  },
})

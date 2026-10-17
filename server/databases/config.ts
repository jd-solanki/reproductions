import { defineDatabase } from 'vite-hub/database'

export default defineDatabase({
  dialect: 'postgresql',
  connection: { url: process.env.DATABASE_URL },
  schema: {},
})

import { defineDatabase } from 'vite-hub/database'
import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export default defineDatabase({
  dialect: 'postgresql',
  schema: {
    notes: pgTable('notes', {
      id: serial('id').primaryKey(),
      title: text('title').notNull(),
    }),
  },
})

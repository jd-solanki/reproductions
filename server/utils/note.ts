import type { schema } from 'vite-hub/database/drizzle'

export type Note = typeof schema.notes.$inferSelect

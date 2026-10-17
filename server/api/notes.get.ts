import { db, useDatabase } from 'vite-hub/database/drizzle'

export default async () => {
  const { schema } = useDatabase('default')
  return { notes: await db.query.notes.findMany(), table: schema.notes }
}

import { db, schema } from 'hub:db'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { title } = await readBody(event)
  await db.update(schema.products).set({ title }).where(eq(schema.products.id, id))
  return { id, title }
})

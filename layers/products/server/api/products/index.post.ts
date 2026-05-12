import { db, schema } from 'hub:db'

export default eventHandler(async (event) => {
  const { title } = await readBody(event)
  const id = crypto.randomUUID()
  await db.insert(schema.products).values({ id, title })
  return { id, title }
})

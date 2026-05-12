import { db, schema } from 'hub:db'

export default eventHandler(() => db.select().from(schema.products))

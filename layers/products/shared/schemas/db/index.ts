// import { products } from '#layers/products/server/db/schema'
import { schema } from '@nuxthub/db'
import type { InferInsertModel } from 'drizzle-orm'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

export const dbSchemaInsertProduct = createInsertSchema(schema.products, {
  title: z.string().min(1, 'Title is required'),
})
export const dbSchemaUpdateProduct = createUpdateSchema(schema.products, {
  title: z.string().min(1, 'Title is required').optional(),
})

export type DBInsertProduct = InferInsertModel<typeof schema.products>

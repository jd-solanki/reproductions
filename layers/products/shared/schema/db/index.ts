import { products } from '#layers/products/server/db/schema'
import type { InferInsertModel } from 'drizzle-orm'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

export const dbSchemaInsertProduct = createInsertSchema(products, {
  title: z.string().min(1, 'Title is required'),
})
export const dbSchemaUpdateProduct = createUpdateSchema(products, {
  title: z.string().min(1, 'Title is required').optional(),
})

export type DBInsertProduct = InferInsertModel<typeof products>

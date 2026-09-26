import { relations } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '#auth/schema'

export const orders = sqliteTable('orders', {
  id: text().primaryKey(),
  userId: text().notNull().references(() => user.id),
})

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
}))

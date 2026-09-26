// `pnpm test` (nuxt typecheck) fails on each `Expect` whose fix has not landed. The two are
// independent: each package's fix turns its own check green.
import { db } from '@nuxthub/db'
import { user } from '#auth/schema'

type Expect<T extends true> = T
type IsAny<T> = 0 extends 1 & T ? true : false
type Not<T extends boolean> = T extends true ? false : true
type HasUserColumns<T> = T extends { email: string; name: string } ? true : false

async function orderUser() {
  const [order] = await db.query.orders.findMany({ with: { user: true } })
  return order!.user
}

async function sessionUser() {
  const [session] = await db.query.session.findMany({ with: { user: true } })
  return session!.user
}

// 1. @nuxtjs/better-auth: `#auth/schema` types its tables in the app.
export type AuthSchemaUserIsTyped = Expect<Not<IsAny<typeof user.email>>>

// 2. @nuxthub/core: the layer's relation to `user`, imported through that alias, keeps its columns.
export type LayerRelationKeepsUserColumns = Expect<
  HasUserColumns<Awaited<ReturnType<typeof orderUser>>>
>

// Control: the module's own relation to the same table passes the same check.
export type ControlSessionUserKeepsColumns = Expect<
  HasUserColumns<Awaited<ReturnType<typeof sessionUser>>>
>

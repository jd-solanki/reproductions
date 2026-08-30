import { defineServerAuth } from '@nuxtjs/better-auth/config'
import { magicLink } from 'better-auth/plugins'

declare global {
  // eslint-disable-next-line no-var
  var __reproMagicLink: string | undefined
}

const authKey = (key: string) => `_auth:${key}`

// Hub KV is imported lazily. The module loads this file with jiti at build
// time to generate the Drizzle schema, and a top-level import of
// `@nuxthub/kv` would be executed in that pass -- outside a request, before
// the physical package is guaranteed to exist.
const hubKv = () => import('@nuxthub/kv').then(m => m.kv)

/**
 * The control storage, used by the two steps that set
 * `auth.hubSecondaryStorage: 'custom'`.
 *
 * `get`, `set` and `delete` are the module's own three methods, copied from
 * `buildSecondaryStorageCode` in `@nuxtjs/better-auth/dist/module.mjs`: same
 * hub KV instance, same `_auth:` key prefix, same semantics. `getAndDelete`
 * and `increment` are the two better-auth 1.7 added. That is the entire
 * difference between this object and the one the module generates, which is
 * what makes it a control rather than a second variable.
 */
function createCompleteSecondaryStorage() {
  return {
    get: async (key: string) => (await hubKv()).get(authKey(key)),
    set: async (key: string, value: string, ttl?: number) => {
      await (await hubKv()).set(authKey(key), value, { ttl })
    },
    delete: async (key: string) => {
      await (await hubKv()).del(authKey(key))
    },
    getAndDelete: async (key: string) => {
      const kv = await hubKv()
      const value = await kv.get(authKey(key))
      if (value === null || value === undefined)
        return null
      await kv.del(authKey(key))
      return value as string
    },
    increment: async (key: string, ttl?: number) => {
      const kv = await hubKv()
      const next = Number(await kv.get(authKey(key)) ?? 0) + 1
      await kv.set(authKey(key), next, { ttl })
      return next
    },
  }
}

export default defineServerAuth(() => ({
  emailAndPassword: { enabled: true },

  // REPRO_STORAGE=custom -> the control. Anything else leaves the module's
  // `hubSecondaryStorage: true` storage in place.
  ...(process.env.REPRO_STORAGE === 'custom'
    ? { secondaryStorage: createCompleteSecondaryStorage() }
    : {}),

  // Rate limiting defaults to `enabled: options.rateLimit?.enabled ?? isProduction`,
  // so symptom B is invisible in dev unless it is turned on by hand. Turning it
  // on here is exactly what a production build does on its own -- see
  // better-auth/dist/context/create-context.mjs:171.
  ...(process.env.REPRO_RATE_LIMIT
    ? { rateLimit: { enabled: true, window: 60, max: 100 } }
    : {}),

  plugins: [
    magicLink({
      // The link is captured, never sent. No SMTP server, no Mailpit, nothing
      // to install: the URL is parked on globalThis and handed back by
      // server/routes/__repro/magic-link.get.ts.
      sendMagicLink: async ({ url }) => {
        globalThis.__reproMagicLink = url
      },
    }),
  ],
}))

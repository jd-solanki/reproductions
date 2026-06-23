# Repro: `@onmax/nuxt-better-auth` — `runtimeConfig` is `{}` during schema generation

Reading `runtimeConfig` **eagerly** inside `defineServerAuth(...)` crashes build-time schema
generation, because the module invokes the config factory with an empty
`{ runtimeConfig: {}, db: null }` context at schema-gen time (but the real `useRuntimeConfig()`
at request time).

- **Module:** `@onmax/nuxt-better-auth@0.0.2-alpha.32`
- **Nuxt:** 4.4.8 · **better-auth:** 1.6.11 · **@nuxthub/core:** 0.10.7

## Setup

```bash
npm install
npx nuxt prepare
```

## What to look at

- [`server/auth.config.ts`](./server/auth.config.ts) — contains the **eager** read that triggers the bug:
  ```ts
  export default defineServerAuth(({ runtimeConfig }) => ({
    // ...
    // EAGER read -> evaluated the instant the factory runs; schema-gen passes `{}`
    appName: runtimeConfig.public.app.routes.signUp,
  }))
  ```
- [`nuxt.config.ts`](./nuxt.config.ts) — note `hub: { db: 'sqlite' }`. A DB dialect must exist or
  schema generation is skipped and the bug stays hidden.

## Result

`npx nuxt prepare` fails (exit 1):

```
ERROR  Failed to load auth config: Cannot read properties of undefined (reading 'app')
    at loadUserAuthConfig (node_modules/@onmax/nuxt-better-auth/dist/module.mjs:324:13)
    at async loadAuthOptions (node_modules/@onmax/nuxt-better-auth/dist/module.mjs:391:22)
    at async setupBetterAuthSchema (node_modules/@onmax/nuxt-better-auth/dist/module.mjs:406:37)
    at async setup (node_modules/@onmax/nuxt-better-auth/dist/module.mjs:1358:7)
```

In `nuxt dev` the error is caught instead, so the build silently continues with an **incomplete
schema** — which surfaces downstream as misleading type errors (e.g. `additionalFields` columns
missing from the generated table: `Property '<col>' does not exist on type 'PgTableWithColumns<…>'`).

Captured output: [`eager-prepare.log`](./eager-prepare.log).

## Eager vs. lazy (the actual trigger)

Move the **same** read inside a lazy hook callback and `nuxt prepare` succeeds (exit 0,
`Generated sqlite schema`), because the callback never runs during schema generation:

```ts
import { createAuthMiddleware } from 'better-auth/api'

export default defineServerAuth(({ runtimeConfig }) => ({
  emailAndPassword: { enabled: true },
  user: { additionalFields: { foo: { type: 'string', required: false } } },
  hooks: {
    before: createAuthMiddleware(async () => {
      const _ok = runtimeConfig.public.app.routes.signUp // lazy: fine
    }),
  },
}))
```

Captured output: [`lazy-prepare.log`](./lazy-prepare.log).

## Suggested fix

Pass the resolved `nuxt.options.runtimeConfig` (at least `.public`) into the factory at schema-gen
time, and/or type `ServerAuthContext.runtimeConfig` as Nuxt's `RuntimeConfig` and document that it
is empty during schema generation so eager reads must be guarded.

---

Originally hit in the [nuxtstart](https://github.com/nuxtstart/nuxtstart) starter while wiring the
Polar plugin's `successUrl` / `returnUrl` to `runtimeConfig.public.app.routes.*`.

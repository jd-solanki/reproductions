# Repro: `@nuxtjs/better-auth` — the `better-auth:config:extend` hook drops most of what it is given

The hook is typed `(config: Partial<BetterAuthOptions>) => void` and its doc comment says it
extends the config "with additional plugins or options". Two things are not true of it.

**(A) Only `config.plugins` is read.** Every other key set on the object is discarded without a
warning. Set `config.user.additionalFields` and nothing happens.

**(B) Nothing set on it reaches the running auth instance.** The hook fires during build-time
schema generation only. A plugin contributed through it lands in the generated Drizzle schema, so
the columns look right, but its endpoints are never mounted and its hooks never run.

The two combine badly: `plugins` is the one key that appears to work, and it is the one whose
effect is confined to a file on disk.

- **Module:** `@nuxtjs/better-auth@0.2.2` (formerly `@onmax/nuxt-better-auth`, last published 0.1.2)
- **Nuxt:** 4.5.2 · **better-auth:** 1.7.2 · **@nuxthub/core:** 0.10.8 · **Node:** 24.20.0

## Run it

```bash
npm install
npm run repro
```

## What it does

Three steps, all automated in [`repro.mjs`](./repro.mjs).

1. Runs `nuxt prepare` and reads the generated `.nuxt/better-auth/schema.sqlite.ts`.
   [`demo-module/index.ts`](./demo-module/index.ts) sets two things on the hook object: a plugin
   carrying a `viaPluginField` column, and a `user.additionalFields.viaHookField`. Only one of
   them arrives.
2. Runs `nuxt dev` and asks for `/api/auth/demo-ping`, the endpoint carried by the plugin that
   step 1 just proved reached schema generation.
3. Runs `nuxt dev` again with `REPRO_DIRECT=1`. That flag stands the hook down and declares the
   very same plugin in [`server/auth.config.ts`](./server/auth.config.ts) instead.

Step 3 is the positive control for step 2. Without it a 404 could mean the plugin is malformed;
with it, the only variable left is how the plugin got there.

Each dev run also has its own control. `/api/auth/get-session` is a built-in Better Auth route,
so a real status from it means the handler is mounted and a 404 on `demo-ping` is a missing
endpoint rather than a server that never came up. The `warmup` column is `GET /`, which settles
on 404 because the app has no pages.

## Result

```
================ RESULT ================
schema has "viaPluginField" (set via hook config.plugins)   : true
schema has "viaHookField"   (set via hook config.user.*)    : false
step 2  plugin via hook     : warmup 404   control 200   demo-ping 404
step 3  plugin via config   : warmup 404   control 200   demo-ping 200
----------------------------------------
step 2  control body   : "null"
step 2  demo-ping body : ""
step 3  control body   : "null"
step 3  demo-ping body : "{\"ok\":true}"
========================================

(A) CONFIRMED: only `plugins` survived the hook; `user.additionalFields` was dropped.
(B) CONFIRMED: the same plugin serves 200 when declared in auth.config.ts, but 404 when contributed through the hook.
```

Both dev servers answered the control with `200` and a body of `null`, so both were fully up. The
same plugin object, in the same app, is `404` when it arrives through the hook and `200` with the
handler's own `{"ok":true}` when it arrives through `auth.config.ts`. Full output in
[`repro.log`](./repro.log).

## Why it matters

A module that contributes auth config has no way to know it failed. The schema file gains the
columns, `drizzle-kit generate` writes a migration for them, the database grows the columns, and
the plugin that was supposed to populate them is not running. Nothing logs a warning at any point.

The `user.additionalFields` half is quieter still. It never reaches the schema either, so a
module author sees a missing column and reasonably concludes they used the hook wrong, when the
hook simply does not read that key.

## Where it happens

`loadAuthOptions` builds the object it hands to the hook as
`const extendedConfig: { plugins?: BetterAuthPlugin[] } = {}`, then keeps only `.plugins` from it:

```js
const extendedConfig = {}
await context.nuxt.callHook('better-auth:config:extend', extendedConfig)
const plugins = [...userConfig.plugins || [], ...extendedConfig.plugins || []]
```

That is `src/module/schema.ts:78` and `:81` in the repository, `dist/module.mjs:410` as shipped.
The hook is typed far wider than that at `src/types/hooks.ts:36`, which is where the mismatch
starts.

`loadAuthOptions` has exactly one caller, `setupBetterAuthSchema`, which does nothing but write
the schema file. `grep -rn "config:extend" node_modules/@nuxtjs/better-auth/dist/runtime/` returns
zero hits, and the runtime instance is built at
`dist/runtime/server/utils/auth.js:236` from `createServerAuth(...)` plus database, secret,
baseURL and trustedOrigins. There is no path from the hook to that object.

## Notes for anyone running this

`repro.mjs` asks the OS for a free port and passes it with `--port`, then checks the port in the
startup banner against the one it asked for. `nuxt dev` shifts to the next free port when its own
is taken and says so only in that banner, which is an easy way to spend an afternoon probing a
different dev server. It also spawns with `detached: true` so the whole `npx` process tree can be
killed by process group. Without that the dev server survives the run and squats the port for the
next one.

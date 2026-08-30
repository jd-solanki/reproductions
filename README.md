# Repro: `@nuxtjs/better-auth` generates a `secondaryStorage` that better-auth 1.7 cannot use

Setting `auth.hubSecondaryStorage: true` makes the module write a Better Auth `secondaryStorage`
over NuxtHub KV. It writes three methods:

```js
// .nuxt/better-auth/secondary-storage.mjs, as generated
import { kv } from '@nuxthub/kv'
export function createSecondaryStorage() {
  return {
    get: async (key) => kv.get(`_auth:${key}`),
    set: async (key, value, ttl) => kv.set(`_auth:${key}`, value, { ttl }),
    delete: async (key) => kv.del(`_auth:${key}`),
  }
}
```

That was the whole `SecondaryStorage` contract up to better-auth 1.6. better-auth 1.7 added
`getAndDelete` and `increment` as **required** members of the interface
(`@better-auth/core/dist/db/type.d.mts:148`) and removed the read-then-write fallbacks that used to
cover their absence. So the object above is missing two methods that the runtime now calls
unguarded.

**The module requires the version it does not implement.** `@nuxtjs/better-auth@0.2.2` declares
`"better-auth": ">=1.7.1 <2"` in its `peerDependencies`. There is no supported better-auth version
where this storage is complete.

- **Module:** `@nuxtjs/better-auth@0.2.2` · **better-auth:** 1.7.2 · **Nuxt:** 4.5.2 ·
  **@nuxthub/core:** 0.10.8 · **Node:** 24.20.0

## Run it

```bash
npm install
npm run repro
```

Everything is automated in [`repro.mjs`](./repro.mjs). No SMTP server, no Mailpit, no cloud account:
hub KV runs locally on the `fs-lite` driver and the magic link is captured rather than sent.

## Symptom B is the serious one: every auth request 500s in production

`create-context.mjs:174` picks the rate-limit backend for you:

```js
storage: options.rateLimit?.storage || (options.secondaryStorage ? 'secondary-storage' : 'memory')
```

and `:171` enables rate limiting by default in production only:

```js
enabled: options.rateLimit?.enabled ?? isProduction
```

`getRateLimitStorage` (`api/rate-limiter/index.mjs:199`) then throws
`BetterAuthError('Secondary-storage rate limiting requires SecondaryStorage.increment.')`. That
check runs in `onRequestRateLimit`, before any route handler, on **every** path under the auth
handler. So `hubSecondaryStorage: true` on its own is enough: `GET /api/auth/get-session` returns
`500`, and so does everything else.

The timing is the nasty part. `rateLimit.enabled` defaults to `isProduction`, so a dev server looks
completely healthy and the app dies on deploy. The repro sets `rateLimit: { enabled: true }`
explicitly so the same failure shows up without a production build.

## Symptom A: consuming a verification token 500s

`consumeVerificationValue` (`db/internal-adapter.mjs:806-811`) takes the secondary-storage branch
whenever a secondary storage exists and `verification.storeInDatabase` is falsy, and calls
`secondaryStorage.getAndDelete(key)` with no capability check:

```js
if (secondaryStorage && !options.verification?.storeInDatabase) {
  const consumeCacheKey = async (key) => {
    return hydrateCachedVerification(await secondaryStorage.getAndDelete(key))
  }
```

Result: `TypeError: secondaryStorage.getAndDelete is not a function`, and a 500.

Ten files in better-auth 1.7.2 call `consumeVerificationValue`. Among them are password reset
(`api/routes/password.mjs`) and email-change confirmation (`api/routes/update-user.mjs`) in the
core, plus the magic link, email OTP, one-time token, phone number, SIWE and two-factor plugins.
`grep -rl consumeVerificationValue node_modules/better-auth/dist/` lists them. The repro drives
magic link because it is the shortest end-to-end path, but the failure belongs to the shared
helper, not to that plugin.

## What the repro does

Six steps.

**Step 0** wipes `.nuxt`, `.data` and the generated migrations, runs `nuxt prepare`, and reads
`.nuxt/better-auth/secondary-storage.mjs` back to record which of the five methods it defines. This
is a static assertion with no server involved.

**Step 0b** runs `nuxt db generate` once, under the default configuration, so magic link has a
`user` table to write to. Migrations are generated once and reused by every later step on purpose:
`hubSecondaryStorage: 'custom'` omits the session table from the generated schema, and regenerating
under it would make the control differ from the subject in a second way.

**Step A1** runs `nuxt dev` with the module's own storage, requests a magic link, reads it out of
the repro's stand-in inbox and follows it. Expected: `500`.

**Step A2** is the positive control for A1. Same code, same flow, same hub KV instance, one change:
`auth.hubSecondaryStorage: 'custom'` and a `secondaryStorage` in
[`server/auth.config.ts`](./server/auth.config.ts) that adds `getAndDelete` and `increment` to the
module's own three methods. `'custom'` is the module's documented escape hatch — see
`resolveCustomSecondaryStorageRequirement` in
`dist/runtime/server/utils/custom-secondary-storage.js`. Expected: `302` to the callback URL with a
session cookie.

**Step B1** runs `nuxt dev` with the module's storage and `rateLimit.enabled` forced on, then makes
one plain `GET /api/auth/get-session`. Expected: `500`.

**Step B2** is the positive control for B1: same request, `'custom'` storage. Expected: `200`.

Each step carries its own liveness control, so a failure cannot be confused with a server that never
came up. The magic-link steps use `GET /api/auth/get-session` — a built-in route, so a real status
from it proves the auth handler is mounted. The rate-limiting steps cannot use an auth route for
that (they break all of them), so they use `/__repro/magic-link`, a route this repro owns. The
`warmup` column is `GET /`, which settles on `404` because the app has no pages.

Both symptoms are also asserted against what the dev server logged, not only the HTTP status.
Better Auth returns a bare 500 for symptom A, so the `TypeError` only exists in the server output.

## Result

Real output from `npm run repro`. Full log in [`repro.log`](./repro.log).

```
======= RESULT =======
generated .nuxt/better-auth/secondary-storage.mjs implements
  get          : true
  set          : true
  delete       : true
  getAndDelete : false
  increment    : false
----------------------
SYMPTOM A -- consuming a verification value (magic link verify)
  A1 module storage   : warmup 404  get-session 200  sign-in 200  link captured true  verify 500
  A2 custom storage   : warmup 404  get-session 200  sign-in 200  link captured true  verify 302
  A1 server logged "getAndDelete is not a function" : true
  A2 server logged "getAndDelete is not a function" : false
  A1 verify redirect  : -   session cookie false
  A2 verify redirect  : http://localhost:63193/   session cookie true
----------------------
SYMPTOM B -- every auth request, once rateLimit.enabled (production default)
  B1 module storage   : warmup 404  own route 200  get-session 500
  B2 custom storage   : warmup 404  own route 200  get-session 200
  B1 server logged "Secondary-storage rate limiting requires SecondaryStorage.increment." : true
  B2 server logged "Secondary-storage rate limiting requires SecondaryStorage.increment." : false
----------------------
  A1 verify body      : ""
  A2 verify body      : ""
  B1 get-session body : "{ \"statusCode\": 500, \"stack\": [ \"Secondary-storage rate limiting requires SecondaryStorage.increment.\", \"\" ] }"
  B2 get-session body : "null"
----------------------
SYMPTOM A reproduced : true
SYMPTOM B reproduced : true
======================
```

The two lines the server printed in step A1, from `repro.log`:

```
ERROR  2026-08-30T11:25:26.682Z ERROR [Better Auth]: TypeError secondaryStorage.getAndDelete is not a function
ERROR  # SERVER_ERROR:  secondaryStorage.getAndDelete is not a function
```

## Where it happens

`buildSecondaryStorageCode`, `@nuxtjs/better-auth/dist/module.mjs:612-622`. It is the only place the
runtime storage is defined; `dist/runtime/server/utils/auth.js:235` calls `createSecondaryStorage()`
from it whenever `hubSecondaryStorage === true`.

The module already knows the 1.7 shape somewhere else. The stub it feeds to schema generation, at
`dist/module.mjs:433-441`, has all five methods:

```js
secondaryStorage: secondaryStorageResolution.inject ? {
  delete: async (_key) => {},
  get: async (_key) => null,
  getAndDelete: async (_key) => null,
  increment: async (_key, _ttl) => 1,
  set: async (_key, _value, _ttl) => {},
} : void 0
```

So the build-time stub was updated for better-auth 1.7 and the runtime storage was not.

A fix is two methods on the generated object. `getAndDelete` is a get followed by a del, and
`increment` is a read, add one, write back with the TTL applied on creation.
[`server/auth.config.ts`](./server/auth.config.ts) in this repro writes both over the same `kv`
instance, in about a dozen lines. Neither is atomic there, which is fine for a repro but is the
reason the interface asks for them: `increment`'s doc comment says it exists so
secondary-storage-backed rate limiting can enforce the limit in one distributed-safe operation, and
Cloudflare KV cannot offer that. If the module cannot make them atomic, refusing
`hubSecondaryStorage: true` and pointing at `'custom'` would still beat generating an object that
throws.

## Notes for anyone running this

`repro.mjs` asks the OS for a free port per step and passes it with `--port`, then checks the port
in the startup banner against the one it asked for. `nuxt dev` shifts to the next free port when its
own is taken and says so only in that banner, which is an easy way to spend an afternoon probing a
different dev server. It also spawns with `detached: true` so the whole `npx` process tree can be
killed by process group; without that a dev server outlives its step and squats the port.

Two smaller things that cost time here:

- Node's `fetch` sends `sec-fetch-mode: cors` and no `Origin`, and Better Auth answers
  `403 MISSING_OR_NULL_ORIGIN` before any handler runs. The probes send an explicit `Origin`, as a
  browser would. `curl` does not hit this, so a hand-check and the script can disagree.
- The magic link is minted against the server's inferred base URL, which is `http://localhost:PORT`
  rather than the `127.0.0.1` the probe dialled. Only the path and query are reused, against the
  port the script knows it started.

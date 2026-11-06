# Repro: `@nuxtjs/better-auth` drops POST bodies in `nuxt dev` with a Cloudflare preset

A minimal Nuxt app with email/password auth and `nitro.preset: 'cloudflare_module'`. In `nuxt dev`, every POST to `/api/auth/*` reaches Better Auth without its body, so sign-in fails validation.

| | |
| --- | --- |
| Upstream | https://github.com/nuxt-modules/better-auth/issues/712 |
| `@nuxtjs/better-auth` | 0.3.15 |
| `better-auth` | 1.7.18 |
| `nuxt` / `nitropack` | 4.6.4 / 2.13.6 |
| `wrangler` | 4.158.0 |
| `node` / `pnpm` | v24.20.0 / 9.15.4 |

## Run it

```bash
pnpm install
pnpm repro
```

`pnpm repro` starts `nuxt dev`, POSTs `{"email":"a@example.com","password":"password1234"}` as JSON to `/api/auth/sign-in/email`, and exits 1 when Better Auth reports the body missing.

## Expected

Better Auth receives the body and rejects the unknown user:

```
POST /api/auth/sign-in/email -> 401 {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}
```

## Actual

```
POST /api/auth/sign-in/email -> 400 {"message":"[body] Invalid input: expected object, received undefined","code":"VALIDATION_ERROR"}
 ELIFECYCLE  Command failed with exit code 1.
```

In dev, nitropack's Cloudflare preset runs its `cloudflare-dev` plugin, which sets `event.node.req.__unenv__` on every request, including real Node `IncomingMessage`s. `requestBody()` in `src/runtime/server/internal/nitro2.ts` (added by [nuxt-modules/better-auth#649](https://github.com/nuxt-modules/better-auth/pull/649)) treats any request with an `__unenv__` key as an in-process mock with no body:

```ts
return '__unenv__' in req ? undefined : req as unknown as BodyInit
```

So the `Request` handed to `auth.handler()` has no body. Up to 0.3.12, which passed `req` as the body, the same app signs in.

## Control

Remove `nitro: { preset: 'cloudflare_module' }` from `nuxt.config.ts`. The `cloudflare-dev` plugin no longer runs, and `pnpm repro` exits 0 with the expected 401 above.

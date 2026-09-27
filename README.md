# Repro: `@nuxtjs/better-auth` 404s under `app.baseURL`

With `app.baseURL: '/app/'`, every Better Auth endpoint returns 404, and Better Auth builds its
links (magic link, email verification, password reset) and OAuth `redirect_uri` from `/api/auth`
at the origin root, outside the app.

| | |
| --- | --- |
| `@nuxtjs/better-auth` | 0.3.5 (latest; `main` at 640f545 has the same code) |
| `better-auth` | 1.7.3 |
| `@nuxthub/core` | 0.10.8 |
| `nuxt` | 4.5.2 (Nitro 2.13.4, h3 1.15.11) |
| `@nuxt/test-utils` / `vitest` | 4.3.2 / 5.0.2 |
| `node` | v24.20.0 |

## Run it

```bash
pnpm install
pnpm test
```

[`test/app-base-url.test.ts`](./test/app-base-url.test.ts) starts the app in dev and makes two
checks. Both fail; [`repro.log`](./repro.log) holds the run:

```text
× answers /app/api/auth/ok                 AssertionError: expected 404 to be 200
× builds its links under /app/api/auth     AssertionError: expected '/api/auth' to be '/app/api/auth'
```

[`server/api/auth-base.get.ts`](./server/api/auth-base.get.ts) returns `(await auth.$context).baseURL`,
the base Better Auth builds every link from.

Control: the same app with `app.baseURL: '/'` passes the same checks at `/api/auth/ok` and
`/api/auth`.

`rolldown` is a direct dev dependency only because `@nuxthub/core`'s `tsdown` otherwise resolves a
`rolldown` beta where `nuxt` expects `~1.2`, and `nuxt prepare` fails.

## Why

- `validateURL` reduces `siteUrl` to its origin, so a path in it is dropped.
- `serverAuth` sets `baseURL: siteUrl` after spreading the user config, so a `baseURL` from
  `defineServerAuth` is overwritten.
- `defineServerAuth` rejects any `basePath` other than `/api/auth`.
- Better Auth's router takes its base from `baseURL`'s path, `/api/auth`, while h3's
  `toWebRequest` builds the request from `originalUrl`, which still starts with `/app`. The router
  rejects it with an empty 404.

Better Auth itself handles a mount: with `baseURL: 'https://example.com/app/api/auth'` (or the origin
plus `basePath: '/app/api/auth'`), `/app/api/auth/ok` answers and every link carries `/app/api/auth`.

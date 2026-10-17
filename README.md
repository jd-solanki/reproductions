# Repro: `nuxt dev` returns 500 for every request with `preset: 'cloudflare'`, `blob: true` and Nitro's Node dev runner

With `vitehub: { preset: 'cloudflare', blob: true }` and `nitro.devServer.runner: 'node-worker'`, ViteHub still registers `.vitehub/nitro/blob/middleware.ts` in dev. That file imports `cloudflare:workers`, which Node cannot resolve, so every request fails.

| | |
| --- | --- |
| `vite-hub` | pkg.pr.new `c8f6612` |
| `nuxt` | `nuxt-nightly@5.0.0-2610161507-5812474` (Nitro `3.0.260903-beta`) |
| `node` / `pnpm` | `v24.20.0` / `12.11.2` |

Nuxt 4.6.1 (Nitro 2) fails earlier with a different error (`Cannot find module '/.vitehub/nitro/blob/runtime.mjs'`), so this uses the Nuxt 5 nightly.

## Run it

```bash
pnpm install
pnpm repro
```

`pnpm-workspace.yaml` sets `blockExoticSubdeps: false` only to bypass vite-hub/vitehub#2545, and `strictDepBuilds: false` so install finishes without running dependency build scripts. Neither affects the bug.

## Expected

`GET /api/hello -> 200` with `{"ok":true}`.

## Actual

```
GET /api/hello -> 500
first error line: Error: Cannot find module 'cloudflare:workers' imported from '/private/tmp/repro-wt/vite-hub-nuxt-dev-cloudflare-workers--2026-10-17/.vitehub/nitro/blob/middleware.ts'
```

Full error from the dev server:

```
Error: Cannot find module 'cloudflare:workers' imported from '/private/tmp/repro-wt/vite-hub-nuxt-dev-cloudflare-workers--2026-10-17/.vitehub/nitro/blob/middleware.ts'
    at fetchModule (file:///private/tmp/repro-wt/vite-hub-nuxt-dev-cloudflare-workers--2026-10-17/node_modules/.pnpm/vite@8.3.4_@types+node@25.9.9_esbuild@0.28.2_jiti@2.7.0_terser@5.51.2_tsx@4.23.15_yaml@2.9.1/node_modules/vite/dist/node/chunks/node.js:36152:32)
    ...
    at NodeWorkerEnvRunner._handleMessage (file:///private/tmp/repro-wt/vite-hub-nuxt-dev-cloudflare-workers--2026-10-17/node_modules/.pnpm/env-runner@0.2.3/node_modules/env-runner/dist/_chunks/common-base-runner.mjs:134:50)
  code: 'ERR_MODULE_NOT_FOUND',
```

`database: true` alone does not fail: the database bridge middleware is only registered outside dev.

## Control

Change `preset: 'cloudflare'` to `preset: 'node'` in `nuxt.config.ts`: `GET /api/hello -> 200`. Removing `nitro.devServer.runner` (back to workerd) also turns it green.

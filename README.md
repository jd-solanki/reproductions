# Repro: `@nuxt/content` prerenders an HTML page as its D1 `sql_dump.txt` on Nitro v3

A Nuxt 4.7 app with `@nuxt/content` on the D1 database builds for Cloudflare with Nitro v3. The
build succeeds, but the prerendered `/__nuxt_content/content/sql_dump.txt` holds the app's HTML page
instead of the collection dump.

| | |
| --- | --- |
| Upstream | TBD |
| `nuxt` | 4.7.0 |
| `nitro` | 3.0.261103-rc |
| `@nuxt/content` | 3.17.0 |
| `node` / `pnpm` | 26.13.1 / 12.23.0 |

## Run it

```bash
pnpm install
pnpm repro
```

`pnpm repro` runs `nuxt build`, then `verify.mjs`, which fails if the prerendered dump is HTML.

## Expected

`.output/public/__nuxt_content/content/sql_dump.txt` holds the compressed SQL dump of the `content`
collection, and `verify.mjs` prints `OK`.

## Actual

```
◆ Client (vite) built in 1.62s · 1.57 MB (625.34 kB gzip)
  Server (vite) built in 638ms · 449.59 kB
  Prerendered 1 route in 927ms
  /__nuxt_content/content/sql_dump.txt  261ms
  Nitro (rolldown) built in 624ms · 1.22 MB
◆ Build complete in 6.58s
FAIL: sql_dump.txt is an HTML page, not the collection dump:
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script type="importmap">{"imports":{"#entry":"/_nuxt/CCBUOezB.js"}}</script><link
[ELIFECYCLE] Command failed with exit code 1.
```

The Nitro v3 dump handler (`runtime/presets/cloudflare/database-handler.js`) prerenders the route by
calling `serverFetch(event, '/dump.content.sql')`, a public asset. Nuxt's legacy build
(`packages/nitro-server/src/legacy.ts`) copies public assets in `build:config`, which runs after
`prerender(nitro)`, so the asset is not there yet and the request falls through to the Nuxt
renderer. In an app with `pages/` and `experimental.early404`, the same request answers 404 and the
build fails with `NUXT_B1024`.

## Control

Copy public assets before prerendering, in `nuxt.config.ts`:

```ts
import { copyPublicAssets } from 'nitro/builder'

export default defineNuxtConfig({
  // ...
  hooks: {
    'nitro:init'(nitro) {
      nitro.hooks.hook('prerender:init', () => copyPublicAssets(nitro as never))
    },
  },
})
```

`pnpm repro` then prints `OK: sql_dump.txt holds the compressed collection dump`.

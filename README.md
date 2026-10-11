# Repro: `nuxt-email-renderer` breaks `nuxt build` on Nuxt 5

`nuxt-email-renderer@2.11.1` adds its own `@vitejs/plugin-vue` to `nitroConfig.rollupConfig.plugins`.
Nuxt 5 builds the server with Nitro 3 through Vite, and Nuxt's own `vite:vue` already runs there.
Every `.vue` file in the server bundle gets compiled twice, and the second pass parses JavaScript as an SFC.

| | |
| --- | --- |
| `nuxt` | `nuxt-nightly@5.0.0-2610111729-78f43dd` (Nitro 3.0.260903-beta, Vite 8.3.4) |
| `nuxt-email-renderer` | 2.11.1 (`@vitejs/plugin-vue` 6.0.10) |
| `node` / `pnpm` | v24.20.0 / 12.10.1 |

## Run it

```bash
pnpm install
pnpm build
```

The app is one template (`app/emails/Welcome.vue`) and one route (`server/api/email.get.ts`)
that returns `renderEmailComponent('Welcome', ...)`.

## Expected

The build passes and `GET /api/email` returns the email HTML, as it does on Nuxt 4.6.1.

## Actual

`pnpm build` fails, once for each of the module's 21 components:

```
 ERROR  Build failed with 21 errors:

[plugin vite:vue] .../nuxt-email-renderer/dist/runtime/components/subject/ESubject.vue
RolldownError: At least one <template> or <script> is required in a single file component. .../ESubject.vue
SyntaxError: At least one <template> or <script> is required in a single file component. .../ESubject.vue
    at Object.parse$1 [as parse] (.../@vue/compiler-sfc/dist/compiler-sfc.cjs.js:1988:7)
    at createDescriptor (.../@vitejs/plugin-vue/dist/index.mjs:50:42)
```

`pnpm dev` starts, but `GET /api/email` returns a 500.
The log shows the second `vite:vue` receiving code the first one already compiled (`const _sfc_main = defineComponent(...)`):

```
 WARN  Plugin "vite:vue" defines Vite-specific hooks (config, configureServer, configResolved) in a plugin returned from applyToEnvironment. These hooks will be ignored.

Error [TypeError]: Cannot read properties of null (reading 'parse')
  plugin: 'vite:vue',
  id: '.../nuxt-email-renderer/dist/runtime/components/subject/ESubject.vue',
```

## Control

With `"nuxt": "4.6.1"` (Nitro 2.13.4) the same app builds,
and `node .output/server/index.mjs` serves the email on `GET /api/email`.

## Fix

[`patches/nuxt-email-renderer@2.11.1.patch`](./patches/nuxt-email-renderer@2.11.1.patch)
keeps the module's `vue()` instance out of the Nitro plugins when `getNitroVersion(nuxt) === 3`.
The patch is not wired in. To apply it, add this to `package.json` and reinstall:

```json
"pnpm": { "patchedDependencies": { "nuxt-email-renderer@2.11.1": "patches/nuxt-email-renderer@2.11.1.patch" } }
```

With the patch on the nightly, `pnpm build` passes (also with `NITRO_PRESET=cloudflare_module`).
`GET /api/email` returns the email from both `pnpm dev` and `node .output/server/index.mjs`.
On 4.6.1 the patch changes nothing.

On Nuxt 5 the patch loses the module's `whitespace: 'preserve'`, because Nuxt's `vite:vue` compiles
with the default `condense`:

- 4.6.1: `<p ...>Hello   Nuxt 5</p> <a ...>`
- nightly + patch: `<p ...>Hello Nuxt 5</p><a ...>`

`?inline` assets still become data URLs, but Vite's asset handling produces them, not the module's
inline-asset plugin. An SVG comes out URL-encoded (`data:image/svg+xml,%3csvg...`) instead of base64.

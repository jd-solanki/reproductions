# Repro: `nuxt-email-renderer` breaks `nuxt build` on Nuxt 5

`nuxt-email-renderer@2.11.1` adds its own `@vitejs/plugin-vue` to `nitroConfig.rollupConfig.plugins`.
Nuxt 5 (Nitro 3) bundles the server twice when a route is prerendered, and neither bundle works with that:

```mermaid
flowchart LR
  P["module's vue() in<br/>nitroConfig.rollupConfig.plugins"] --> V["Vite server build<br/>Nuxt's vite:vue already runs"]
  P --> R["prerender bundle<br/>rolldown, outside Vite"]
  V -->|module's vue() kept| E1["compiled twice:<br/>At least one &lt;template&gt; or &lt;script&gt; is required"]
  R -->|module's vue() skipped| E2["never compiled:<br/>PARSE_ERROR Unexpected JSX expression"]
```

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

The app is one template (`app/emails/Welcome.vue`), one route (`server/api/email.get.ts`)
that returns `renderEmailComponent('Welcome', ...)`, and `routeRules: { '/': { prerender: true } }`.

## Expected

The build passes, prerenders `/`, and `GET /api/email` returns the email HTML, as it does on Nuxt 4.6.1.

## Actual

### 1. Vite server build: `vite:vue` runs twice

`pnpm build` fails, once for each of the module's 21 components.
Nuxt's own `vite:vue` compiles each `.vue` file, then the module's instance parses that JavaScript as an SFC:

```
 ERROR  Build failed with 21 errors:

[plugin vite:vue] .../nuxt-email-renderer/dist/runtime/components/subject/ESubject.vue
RolldownError: At least one <template> or <script> is required in a single file component. .../ESubject.vue
SyntaxError: At least one <template> or <script> is required in a single file component. .../ESubject.vue
    at Object.parse$1 [as parse] (.../@vue/compiler-sfc/dist/compiler-sfc.cjs.js:1988:7)
    at createDescriptor (.../@vitejs/plugin-vue/dist/index.mjs:50:42)
```

`pnpm dev` starts, but `GET /api/email` returns a 500:

```
 WARN  Plugin "vite:vue" defines Vite-specific hooks (config, configureServer, configResolved) in a plugin returned from applyToEnvironment. These hooks will be ignored.

Error [TypeError]: Cannot read properties of null (reading 'parse')
  plugin: 'vite:vue',
  id: '.../nuxt-email-renderer/dist/runtime/components/subject/ESubject.vue',
```

### 2. Prerender bundle: nothing compiles `.vue`

Skip the module's `vue()` on Nuxt 5 ([`patches/skip-vite-vue.patch`](./patches/skip-vite-vue.patch)) and the Vite build passes.
Nitro 3's prerenderer then bundles the server again with rolldown, outside Vite.
Nuxt's `vite:vue` is not in that bundle, so the module's `.vue` files reach the parser raw:

```
[nitro] ℹ Initializing prerenderer
 ERROR  Build failed with 21 errors:

[PARSE_ERROR] Unexpected JSX expression
   ╭─[ .../nuxt-email-renderer/dist/runtime/components/subject/ESubject.vue:1:1 ]
 1 │ <script>
   │ Help: JSX syntax is disabled and should be enabled via the parser options

    at async buildProduction (.../nitro/dist/_build/rolldown.mjs:139:12)
    at async prerender (.../nitro/dist/_chunks/nitro.mjs:743:2)
```

An app that prerenders nothing never runs this bundle, so the skip alone looks like a fix there.

## Control

With `"nuxt": "4.6.1"` (Nitro 2.13.4) the same app builds,
and `node .output/server/index.mjs` serves the email on `GET /api/email`.

## Patches

Neither patch is wired in. To try one, add it to `package.json` and run `pnpm install`:

```json
"pnpm": { "patchedDependencies": { "nuxt-email-renderer@2.11.1": "patches/full-fix.patch" } }
```

| Patch | On Nuxt 5 | `pnpm build` |
| --- | --- | --- |
| [`skip-vite-vue.patch`](./patches/skip-vite-vue.patch) | Keeps the module's `vue()` out of the Nitro plugins | Fails in the prerender bundle (half 2) |
| [`full-fix.patch`](./patches/full-fix.patch) | Same, and adds it to the prerender bundle through Nitro's `prerender:config` hook | Passes, prerenders `/`, and `GET /api/email` returns the email |

Below Nuxt 5 both patches leave the module as it is.

On Nuxt 5 both lose the module's `whitespace: 'preserve'` in the Vite build,
because Nuxt's `vite:vue` compiles with the default `condense`:

- 4.6.1: `<p ...>Hello   Nuxt 5</p> <a ...>`
- nightly + patch: `<p ...>Hello Nuxt 5</p><a ...>`

`?inline` assets still become data URLs, but Vite's asset handling produces them, not the module's
inline-asset plugin. An SVG comes out URL-encoded (`data:image/svg+xml,%3csvg...`) instead of base64.

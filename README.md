# Repro: nuxt-seo-utils turns every `runtimeConfig.public` key into `unknown`

The app sets one public runtime config key and reads it in `app.vue`. With the `nuxt-seo-utils` debug route registered, `nuxt typecheck` reports the key as `unknown`.

| | |
| --- | --- |
| `nuxt-seo-utils` | 9.0.1 |
| `nuxt` | 4.6.2 |
| `typescript` / `vue-tsc` | 6.0.3 / 3.3.13 |
| `node` / `pnpm` | 24.20.0 / 12.11.2 |

## Run it

```bash
pnpm install
pnpm exec nuxt typecheck
```

`seo: { debug: true }` only registers `/__nuxt-seo-utils/debug.json` outside dev. `nuxt dev` always registers it, so with `typescript.typeCheck: true` the same errors show up in every `nuxt dev` run without `debug`.

## Expected

No errors. `config.public.apiBase` is `string`.

## Actual

```
app/app.vue(3,17): error TS18046: 'config.public.apiBase' is of type 'unknown'.
```

The debug handler's types (`dist/runtime/server/routes/__nuxt-seo-utils/debug.d.ts`) import `dist/runtime/types.d.ts`. Nuxt's generated route types (`.nuxt/server-routes.d.ts`, `.nuxt/types/nitro-routes.d.ts`) reference that handler, so the file joins the program. It augments the wrong module:

```ts
declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    'seo-utils': SeoUtilsRuntimeConfig
  }
}
```

With `seo: { debug: false }`, the handler is not registered and type-checking passes.

## Control

Change that block to `declare module '@nuxt/schema'` in `node_modules/nuxt-seo-utils/dist/runtime/types.d.ts`, and `nuxt typecheck` passes.

The built `types.d.ts` from harlan-zw/nuxt-seo-utils#186 keeps `PublicRuntimeConfig` under `'nuxt/schema'` and still fails with the same error.

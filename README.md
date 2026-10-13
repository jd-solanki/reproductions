# Repro: `@varlock/cloudflare-integration/init` breaks Nuxt 5 prerender on `cloudflare_module`

`@varlock/cloudflare-integration/init` imports `cloudflare:workers` unconditionally.
Nitro 3 prerenders in a Node worker, Node cannot load `cloudflare:` modules, so every prerendered route fails.

| | |
| --- | --- |
| `nuxt` | `nuxt-nightly@5.0.0-2610111729-78f43dd` (Nitro 3.0.260903-beta) |
| `@varlock/cloudflare-integration` / `varlock` | 1.6.1 / 1.22.0 |
| `node` / `pnpm` | v24.20.0 / 12.10.1 |

## Run it

```bash
pnpm install
pnpm build
```

The app sets `nitro.preset: 'cloudflare_module'` and `routeRules: { '/': { prerender: true } }`.
`server/plugins/varlock.ts` imports `@varlock/cloudflare-integration/init`.

## Expected

The build passes and prerenders `/`.

## Actual

```
[nitro] ℹ Prerendering 1 routes
[env-runner] worker init failed: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. Received protocol 'cloudflare:'
[nitro]   ├─ / (102ms)
  │ └── [503]

 ERROR  Exiting due to prerender errors.
```

## Control

Delete the `import '@varlock/cloudflare-integration/init'` line from `server/plugins/varlock.ts`:
the build passes and prerenders `/` and `/_payload.json`.

## Cause

The `./init` export has no runtime condition, so the Node prerender worker gets the Workers-only entry
that statically imports `cloudflare:workers`.

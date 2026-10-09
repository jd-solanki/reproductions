# Repro: preset options under `nitro` are untyped with `compatibilityVersion: 5`

With `future.compatibilityVersion: 5`, `nuxt typecheck` rejects valid nitropack preset options in
`nuxt.config.ts`:

```text
nuxt.config.ts(7,5): error TS2353: Object literal may only specify known properties, and 'cloudflare' does not exist in type 'ResolveNuxtNitroConfig<NitroConfig>'.
```

The flag makes the generated node tsconfig resolve with `nodenext`. nuxt/nuxt#36516 (242e1971e)
maps `nitropack`, `nitropack/types` and `nitropack/runtime` to their declaration files there, so
`preset` now type-checks. `nitropack/presets` is not mapped, and its declarations re-export without
file extensions, which `nodenext` cannot follow:

```ts
// nitropack/presets.d.ts
export * from "./dist/presets/index";

// nitropack/dist/presets/index.d.mts
export { resolvePreset } from "./_resolve";
```

So every preset option (`cloudflare`, `vercel`, `netlify`, …) drops out of `NitroConfig`.

| | |
| --- | --- |
| `nuxt` | `nuxt-nightly@4.6.0-2610091445-242e197` (4.x at 242e1971e) |
| `nitropack` | 2.13.4 |
| `typescript` / `vue-tsc` | 6.0.3 / 3.3.x |
| `node` | v24.20.0 |

## Run it

```bash
pnpm install
pnpm test
```

`pnpm test` runs `nuxt typecheck`. [`repro.log`](./repro.log) holds three runs:

| Nuxt | `compatibilityVersion` | Result |
| --- | --- | --- |
| nightly 242e197 | 5 | `cloudflare` rejected |
| nightly 242e197 | 4 (default) | passes |
| 4.6.0 | 5 | `preset` rejected (nuxt/nuxt#36516) |

Expected: both keys type-check under `compatibilityVersion: 5`, as they do without it.

# Repro: `compatibilityVersion: 5` on Nitro 2 drops `shared/` auto-imports and `defineAppConfig`

For nuxt/nuxt#34142. With `future.compatibilityVersion: 5` on Nuxt 4 (Nitro 2), server code loses
two things the Nuxt 5 upgrade guide says stay available:

- a `shared/utils` export: `ReferenceError: greet is not defined`
- `defineAppConfig`, once server code reads the app config: `ReferenceError: defineAppConfig is not defined`

Both pass with `experimental.nitroAutoImports: true`.

The route imports Nuxt's own helpers from `nuxt/server`, as Nuxt 5 asks. Only `greet`, from
`shared/utils/greet.ts`, is left to auto-import, and the upgrade guide says: "Your own exports from
`server/utils/` and `shared/utils/` are still auto-imported."

| | |
| --- | --- |
| `nuxt` | 4.6.0, and `nuxt-nightly@4.6.0-2610091445-242e197` |
| `nitropack` | 2.13.4 |
| `@nuxt/test-utils` / `vitest` | 4.3.3 / 5.0.3 |
| `node` | v24.20.0 |

## Run it

```bash
pnpm install
pnpm test
```

[`test/compat5.test.ts`](./test/compat5.test.ts) builds the app and calls two routes:

- `/api/greet` returns `greet('nuxt')`.
- `/api/title` returns `useAppConfig(event).title`, from `app/app.config.ts`.

[`repro.log`](./repro.log) holds the runs:

| Nuxt | `nitroAutoImports` | Result |
| --- | --- | --- |
| 4.6.0 | off (compat 5 default) | both fail with a 500 |
| nightly 242e197 | off (compat 5 default) | both fail with a 500 |
| 4.6.0 | `true` | both pass |

With the flag off, `@nuxt/nitro-server` passes Nitro `imports: false`, which drops the `shared/`
dirs and `defineAppConfig` along with h3's helpers.

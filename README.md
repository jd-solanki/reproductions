# Repro: `db.query` loses its schema type in Nuxt 5 server code with the `cloudflare` preset

With `preset: 'cloudflare'`, `.nuxt/tsconfig.server.json` maps `@vite-hub/database/drizzle` to the generated, untyped `.vitehub/database/cloudflare-runtime.mjs`, so TypeScript takes the types of `vite-hub/database/drizzle` from that file instead of the package declarations. The Postgres table comes from a Nuxt layer (`layers/notes`), so the `db` inferred from that file carries the app Definition's empty schema.

| | |
| --- | --- |
| `vite-hub` | pkg.pr.new `c8f6612` |
| `nuxt` | `nuxt-nightly@5.0.0-2610111729-78f43dd` (Nitro `3.0.260903-beta`) |
| `node` / `pnpm` | `v24.20.0` / `12.11.2` |

## Run it

```bash
pnpm install
pnpm repro
```

## Expected

`nuxt typecheck` passes. `db` and `useDatabase` from `vite-hub/database/drizzle` take their types from the package declarations and the generated `DatabaseRegistry` in `.vitehub/types/database.d.ts`, so `db.query.notes` exists.

## Actual

```
$ nuxt prepare && nuxt typecheck
◆ Types generated in .nuxt.
server/api/notes.get.ts(5,34): error TS2339: Property 'notes' does not exist on type 'DrizzleTypeError<"Seems like the schema generic is missing - did you forget to add it to your DB type?">'.
[ELIFECYCLE] Command failed with exit code 2.
```

`.nuxt/tsconfig.server.json`:

```json
"@vite-hub/database/drizzle": [
  "../.vitehub/database/cloudflare-runtime.mjs"
],
```

In the same server project, `useDatabase` types as `(name: any) => any`.

## Control

Set `"nuxt": "^4.6.1"` (Nitro 2), then `pnpm install && pnpm repro`: typecheck passes. Nitro 2 writes the mapping without the extension (`"../.vitehub/database/cloudflare-runtime"`), and TypeScript resolves the package declarations.

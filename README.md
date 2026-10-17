# Repro: Cloudflare output leaves Nuxt layer tables out of `db.query` for a Postgres database

On `preset: 'cloudflare'`, the generated `.vitehub/database/cloudflare-runtime.mjs` calls `createPostgresDatabase(definition_0, …)` with the app Definition, whose `schema` is `{}`. The merged schema `schema_0`, which holds the `notes` table from `layers/notes`, is exported next to `db` but never passed to Drizzle.

| | |
| --- | --- |
| `vite-hub` | pkg.pr.new `c8f6612` |
| `nuxt` | `4.6.1` |
| `node` / `pnpm` | `v24.20.0` / `12.11.2` |

## Run it

```bash
pnpm install
pnpm repro
```

`pnpm repro` runs `nuxt build`, then `check.mjs` imports the generated `.vitehub/database/cloudflare-runtime.mjs` with a dummy `DATABASE_URL` (postgres.js connects only on the first query, so no server is needed).

## Expected

`db.query.notes` is available, because the layer's `notes` table is part of the merged schema:

```
typeof db.query.notes: object
typeof schema.notes: object
```

## Actual

```
◆ ✨ Build complete in 3.94s!
typeof db.query.notes: undefined
typeof schema.notes: object
[ELIFECYCLE] Command failed with exit code 1.
```

`.vitehub/database/cloudflare-runtime.mjs`:

```js
import schema_0 from "./schema/default.ts"
// …
    db: createPostgresDatabase(definition_0, {"binding":"HYPERDRIVE","url":{"kind":"env-variable","source":{"kind":"env","name":"DATABASE_URL"}}}),
    schema: schema_0,
```

## Control

Move the `notes` table from `layers/notes/server/databases/config.ts` into the app Definition `server/databases/config.ts` and delete the layer: `pnpm repro` prints `typeof db.query.notes: object` and exits 0.

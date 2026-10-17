# Repro: `vitehub db generate` in Nuxt writes migrations to `app/server/databases/migrations`

In a Nuxt 4 app (`srcDir` is `app/`), `pnpm exec vitehub db generate` writes migrations under `app/server/databases/migrations/` instead of next to `server/databases/config.ts`. It never sees the committed `0000_*` migration, so it starts a fresh `0000_*.sql` that creates every table again.

| | |
| --- | --- |
| `vite-hub` | pkg.pr.new `c8f6612` |
| `nuxt` | 4.6.1 |
| `node` / `pnpm` | 24.20.0 / 12.11.2 |

## Run it

```bash
pnpm install
pnpm repro
```

`blockExoticSubdeps: false` in `pnpm-workspace.yaml` only bypasses vite-hub/vitehub#2545. `strictDepBuilds: false` lets install finish without running dependency build scripts. Nuxt is 4.6.1 because 4.6.2 is still inside pnpm's `minimumReleaseAge` window.

`server/databases/migrations/` holds a baseline `0000_*` for the `notes` table with `id`. The Definition in `server/databases/config.ts` adds a `title` column. `pnpm repro` resets the migrations to the committed state, runs `pnpm exec vitehub db generate`, and fails when migrations land in `app/server/databases/migrations` or no `0001_*.sql` appears in `server/databases/migrations`.

## Expected

`server/databases/migrations/0001_*.sql` adds the `title` column. Nothing is written under `app/`.

## Actual

```txt
$ node repro.mjs
Reading config file '/private/tmp/repro-wt/vite-hub-db-generate-nuxt-srcdir--2026-10-17/.vitehub/database/drizzle.config.ts'
1 tables
notes 2 columns 0 indexes 0 fks

[✓] Your SQL migration file ➜ server/databases/migrations/0000_flashy_rhino.sql 🚀

server/databases/migrations: 0000_swift_yellowjacket.sql
app/server/databases/migrations: 0000_flashy_rhino.sql

FAIL: migrations written to app/server/databases/migrations; no 0001_*.sql in server/databases/migrations
[ELIFECYCLE] Command failed with exit code 1.
```

The generated `.vitehub/database/drizzle.config.ts` (at the Nuxt `rootDir`) has `out: "server/databases/migrations"`, and drizzle-kit resolves it against `app/`.

Side note: running `node_modules/.bin/vitehub db generate` without `node_modules/.bin` on `PATH` fails with `[ENOENT] spawn drizzle-kit ENOENT`. With the control below it succeeds, so the CLI looks for drizzle-kit under `app/node_modules/.bin`.

## Control

Add `vite: { root: '.' }` to `nuxt.config.ts`. `pnpm repro` then writes `server/databases/migrations/0001_*.sql` and passes. Setting the documented `vitehub.database.projectRoot: '.'` does not change the result.

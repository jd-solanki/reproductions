# Repro: `schema` from `vite-hub/database/drizzle` is untyped in a Nuxt app

`vite-hub/database/drizzle` types `schema` from `#vitehub/database/schema`. TypeScript resolves that through `@vite-hub/database`'s `imports` field to `dist/runtime/virtual-schema.d.ts` (`Record<string, unknown>`), so the generated `declare module "#vitehub/database/schema"` augmentation never applies and every table is `unknown`.

| | |
| --- | --- |
| `vite-hub` | pkg.pr.new `c8f6612` |
| `nuxt` | 4.6.1 |
| `node` / `pnpm` | v24.20.0 / 12.11.2 |

## Run it

```bash
pnpm install
pnpm repro
```

## Expected

[`server/utils/note.ts`](./server/utils/note.ts) type-checks: `typeof schema.notes.$inferSelect` is the row type of the `notes` table from [`server/databases/config.ts`](./server/databases/config.ts).

## Actual

```text
$ nuxt prepare && nuxt typecheck
◆ Types generated in .nuxt.
server/utils/note.ts(3,27): error TS2571: Object is of type 'unknown'.
server/utils/note.ts(3,27): error TS2571: Object is of type 'unknown'.
[ELIFECYCLE] Command failed with exit code 2.
```

Also seen:

- On `preset: 'node'`, `nuxt prepare` writes no `.vitehub/types/database.d.ts` (`.vitehub/types/` holds only `env.d.ts` and `markdown-template.d.ts`).
- `.vitehub/types.d.ts` is included in `.nuxt/tsconfig.app.json` and `.nuxt/tsconfig.server.json`, not in `tsconfig.shared.json` or `tsconfig.node.json`.

## Control

Set `preset: 'vercel'` and read the table through the generated `DatabaseRegistry` instead:

```ts
import type { useDatabase } from 'vite-hub/database/drizzle'

export type Note = ReturnType<typeof useDatabase<'default'>>['schema']['notes']['$inferSelect']
```

`pnpm repro` passes. On the same `vercel` preset, `typeof schema.notes.$inferSelect` still fails with TS2571.

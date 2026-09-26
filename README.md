# Repro: a layer's relation to `user` through `#auth/schema` loses its types

A Nuxt layer owns an `orders` table that references the module's `user` table, imported from
`#auth/schema`. The runtime schema is fine, but the types are not:

- `#auth/schema` types every table as `any`.
- The layer's `orders → user` relation comes out of `@nuxthub/db` as `One<any>`, so a relational
  query `with: { user: true }` returns a `user` typed `{ id: string }`, with every other column
  missing.

The module's own relations to the same table, such as `session → user`, are fully typed.

| | |
| --- | --- |
| `@nuxtjs/better-auth` | 0.3.5 (latest) |
| `@nuxthub/core` | 0.10.8 (latest) |
| `better-auth` | 1.7.6 |
| `drizzle-orm` | 0.45.3 |
| `nuxt` | 4.5.2 |
| `typescript` / `vue-tsc` | 6.0.3 / 3.3.11 |
| `node` | v24.20.0 |

## Run it

```bash
pnpm install
pnpm test   # nuxt typecheck
```

[`server/typeCheck.ts`](./server/typeCheck.ts) holds one check per package and a control.
[`repro.log`](./repro.log) holds a failing run:

```text
server/typeCheck.ts(22,44): error TS2344: Type 'false' does not satisfy the constraint 'true'.  <- 1. @nuxtjs/better-auth
server/typeCheck.ts(26,3): error TS2344: Type 'false' does not satisfy the constraint 'true'.   <- 2. @nuxthub/core
```

The layer is [`layers/orders`](./layers/orders/server/db/schema/orders.ts), which Nuxt registers
automatically. `rolldown` is a direct dev dependency only because `@nuxthub/core`'s `tsdown`
otherwise resolves a `rolldown` beta where `nuxt` expects `~1.2`, and `nuxt prepare` fails.

## Two independent bugs

1. **`@nuxtjs/better-auth` declares `#auth/schema` as `any`.** Its type template declares
   `declare module '#auth/schema' { export const user: any … }`. The alias points at the
   generated `better-auth/schema.mjs`, which has no declaration beside it, so the ambient `any`
   is what TypeScript uses, although the module already generates the typed
   `better-auth/schema.<dialect>.ts`.
2. **`@nuxthub/core` builds the schema's declarations without Nuxt aliases.**
   `buildDatabaseSchema` hands `nuxt.options.alias` to the JS bundle, which is why runtime works.
   The `dts` step runs with `tsconfig: false` and no `paths`, so any aliased import in a layer's
   schema becomes `any` in `@nuxthub/db`'s types.

## Fixes, verified against this repro

[`fixes/`](./fixes) holds one diff per package against its installed `dist`. They are sketches for
the maintainers, not proposed code. Each applies on its own:

```bash
patch -p1 -d node_modules/@nuxtjs/better-auth < fixes/nuxtjs-better-auth.diff
patch -p1 -d node_modules/@nuxthub/core < fixes/nuxthub-core.diff
```

| Applied | Check 1 | Check 2 |
| --- | --- | --- |
| neither | fails | fails |
| [`nuxtjs-better-auth.diff`](./fixes/nuxtjs-better-auth.diff) | passes | fails |
| [`nuxthub-core.diff`](./fixes/nuxthub-core.diff) | fails | passes |
| both | passes | passes |

- `nuxtjs-better-auth.diff` writes `better-auth/schema.d.ts` (and `.d.mts`) re-exporting the
  generated dialect file, and drops the ambient `any` declaration, which otherwise wins over it.
- `nuxthub-core.diff` passes the Nuxt aliases to the `dts` step as `compilerOptions.paths`,
  extensionless so TypeScript finds the declaration beside a `.mjs` target, plus `alias/*`
  wildcards.

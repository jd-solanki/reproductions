# Repro: `vite-hub/nuxt` imported into `modules` fails `nuxt typecheck`

`vite-hub/nuxt` declares `getMeta: () => { configKey: "vitehub"; name: "vite-hub/nuxt" }`. Nuxt's `NuxtModule` declares `getMeta?: () => Promise<ModuleMeta>`, so the imported module is not assignable to a `modules` entry.

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

[`nuxt.config.ts`](./nuxt.config.ts) type-checks with the imported module in `modules`, as the ViteHub Nuxt guide registers it.

## Actual

```text
$ nuxt prepare && nuxt typecheck
◆ Types generated in .nuxt.
nuxt.config.ts(4,13): error TS2322: Type 'ViteHubNuxtModule' is not assignable to type 'string | false | NuxtModule<any, Partial<any>, false> | [string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>, Record<...>] | ... 4 more ... | undefined'.
  Type 'ViteHubNuxtModule' is not assignable to type 'NuxtModule<any, Partial<any>, false>'.
    The types returned by 'getMeta()' are incompatible between these types.
      Type '{ configKey: "vitehub"; name: "vite-hub/nuxt"; }' is missing the following properties from type 'Promise<ModuleMeta>': then, catch, finally, [Symbol.toStringTag]
[ELIFECYCLE] Command failed with exit code 2.
```

## Control

Register the module by name: `modules: ['vite-hub/nuxt']` (and drop the import). `pnpm repro` passes.

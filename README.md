# Repro: `vite-hub` 0.0.4 fails to install with pnpm 12 defaults

This package depends only on `vite-hub@0.0.4`. `pnpm install` fails because `@vite-hub/agent@0.0.4` depends on `@t3tools/provider-runtime` through a pkg.pr.new URL, and pnpm 12 blocks URL subdependencies by default (`blockExoticSubdeps`).

| | |
| --- | --- |
| `vite-hub` | 0.0.4 |
| `node` / `pnpm` | 24.20.0 / 12.11.2 (via corepack, from `packageManager`) |

## Run it

```bash
pnpm install
```

## Expected

The dependency tree resolves: every published dependency of `vite-hub` comes from the npm registry.

## Actual

```
Error: ERR_PNPM_EXOTIC_SUBDEP

  × installing dependencies
  ╰─▶ Failed to resolve dependency tree: Exotic dependency "@t3tools/provider-
      runtime" (resolved via url) is not allowed in subdependencies when
      blockExoticSubdeps is enabled
```

`main` still pins `@t3tools/provider-runtime` and `forges` to pkg.pr.new URLs in the catalog ([`pnpm-workspace.yaml` lines 9 and 11](https://github.com/vite-hub/vitehub/blob/c8f66122a7e5d125e068615725512d4bf5faa593/pnpm-workspace.yaml#L9-L11)), so the next release carries the same failure.

# Repro: `vite-hub` install fails under `trustPolicy: no-downgrade`

`vite-hub` lists provider SDKs as regular `dependencies`, so every app installs them, and one of them fails pnpm's `trustPolicy: no-downgrade` check. `blockExoticSubdeps: false` in `pnpm-workspace.yaml` only bypasses a separate bug (`ERR_PNPM_EXOTIC_SUBDEP`) so the install reaches the trust check.

| | |
| --- | --- |
| `vite-hub` | `0.0.4` |
| `node` / `pnpm` | `24.20.0` / `12.11.2` |

## Run it

```bash
pnpm install
```

## Expected

`pnpm install` succeeds. An app that uses only Database and Blob should not install `@vercel/sandbox`, `@vite-hub/agent` or `@vercel/connect` at all, so a trust downgrade in one of them should not block it.

## Actual

```
Progress: resolved 0, reused 1, downloaded 0, added 0
Error:   × installing dependencies
  ├─▶ Failed to resolve dependency tree: Failed to resolve dependency: High-
  │   risk trust downgrade for "@vercel/connect@0.6.1" (possible package
  │   takeover)
  │   
  │   Failed to resolve @vercel/connect@0.6.1
  │   This error happened while installing the dependencies of vite-hub@0.0.4
  │   This error happened while installing the dependencies of @vite-hub/
  │   agent@0.0.4
  ╰─▶ Failed to resolve dependency: High-risk trust downgrade for "@vercel/
      connect@0.6.1" (possible package takeover)
```

`@vite-hub/agent@0.0.4` pins `@vercel/connect` to exactly `0.6.1`. Versions `0.1.1` to `0.6.0` were published with provenance; `0.6.1` was not.

## Control

Remove `trustPolicy: no-downgrade` from `pnpm-workspace.yaml`. With `pnpm install --config.trust-policy=off` the trust error is gone and all 1085 packages resolve and link. pnpm 12 then exits 1 with `ERR_PNPM_IGNORED_BUILDS` (unapproved build scripts), which is unrelated.

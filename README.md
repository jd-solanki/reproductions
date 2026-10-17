# Repro: pnpm 12 relock is OOM-killed verifying the lockfile against supply-chain policies

The `package.json` files, `pnpm-workspace.yaml` and `pnpm-lock.yaml` of a real 11-project Nuxt monorepo (1,798 lockfile entries, `trustPolicy: no-downgrade` and `minimumReleaseAge: 1440`), with scripts, source and patches removed. A Renovate-style relock, with a cold cache and one catalog specifier bumped, is OOM-killed under a 2.25 GB cap on pnpm 12.14.0, but completes on pnpm 11.28.4 and on 12.14.0 with `MALLOC_ARENA_MAX=2`.

| | |
| --- | --- |
| `pnpm` | 12.14.0 (11.28.4 passes) |
| `node` | 24.22.0 (`node:24` image) |
| Docker | Linux arm64 and amd64, 12 CPUs, `--memory=2250m` |

## Run it

Needs Docker. Inside a `node:24` container capped at 2.25 GB, the script bumps `vue-router` in the catalog and runs Renovate's relock command:

```bash
./repro.sh   # exits 137
```

`PNPM_VERSION`, `CAP` and `MALLOC_ARENA_MAX` override the defaults.

## Expected

The relock completes under 2.25 GB, as it does on pnpm 11.28.4.

2.25 GB is an estimate of what Mend-hosted Renovate leaves pnpm, since Renovate and pnpm share one 3 GB VM there. This workspace's relocks there succeeded on pnpm 11, but on pnpm 12 the job is killed at 3.0 of 3.0 GB.

## Actual

```
Scope: all 11 workspace projects
? Verifying lockfile against supply-chain policies (1798 entries)...
bash: line 10:    40 Killed                  CI=true pnpm install --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile
pnpm 12.14.0: exit 137, peak RSS 2.25 GB (cap 2250m)
repro.sh: container exited 137, OOM-killed under the 2250m cap
```

Peak RSS is summed over the container's processes and sampled every 200 ms, so a killed run shows the last sample before the kill.

| Run | 11.28.4 | 12.14.0 | 12.14.0, `MALLOC_ARENA_MAX=2` |
| --- | --- | --- | --- |
| arm64, no cap (×2) | 2.02, 1.96 GB | 3.11, 3.33 GB | 1.49, 1.53 GB |
| arm64, 2.25 GB (×3) | 1.91, 1.97, 1.85 GB | killed ×3 | 1.45, 1.63, 1.55 GB |
| arm64, 2.25 GB, `./repro.sh` (×3) | | killed ×3 | |
| amd64, 2.25 GB, `./repro.sh` | 1.97 GB | killed | 1.54 GB |

## Control

```bash
MALLOC_ARENA_MAX=2 ./repro.sh      # pnpm 12.14.0 with MALLOC_ARENA_MAX=2: exit 0, peak RSS 1.54 GB
PNPM_VERSION=11.28.4 ./repro.sh    # pnpm 11.28.4: exit 0, peak RSS 1.97 GB
```

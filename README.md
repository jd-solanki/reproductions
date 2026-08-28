# Repro: `@onmax/nuxt-better-auth` — dev overwrites a good schema with an incomplete one

When `server/auth.config.ts` fails to load, `nuxt dev` logs one error line and then generates
the Better Auth schema anyway, from empty options. Every `user.additionalFields` entry and every
plugin-contributed column disappears from the file that was already on disk.

`nuxt prepare` throws on the same input. Only the dev path is quiet.

- **Module:** `@onmax/nuxt-better-auth@0.1.2`
- **Nuxt:** 4.5.2 · **better-auth:** 1.7.2 · **@nuxthub/core:** 0.10.8 · **Node:** 24.20

## Run it

```bash
npm install
npm run repro
```

## What it does

Three steps, all automated in [`repro.mjs`](./repro.mjs).

1. Copies [`server/auth.config.ts.good`](./server/auth.config.ts.good) into place and runs
   `nuxt prepare`. The config declares `user.additionalFields.customField`.
2. Copies [`server/auth.config.ts.broken`](./server/auth.config.ts.broken) into place and runs
   `nuxt dev`. The only difference between the two files is one import that does not resolve.
3. Runs `nuxt prepare` on the same broken config, to show the two commands disagree.

## Result

```
================ RESULT ================
step 1  prepare, config OK      -> customField present: true
step 2  dev, config fails       -> customField present: false
step 3  prepare, config fails   -> exit code: 1
========================================
```

The generated `.nuxt/better-auth/schema.sqlite.ts` had `customField: text("customField")` after
step 1. After step 2 the file is still there and that column is gone.

The two lines that matter, from [`repro.log`](./repro.log):

```
 ERROR  [@onmax/nuxt-better-auth] Failed to load auth config for schema generation.
        Schema may be incomplete: Cannot find module './does-not-exist'

...

[nuxt-better-auth] ℹ Generated sqlite schema (.ts + .mjs)
```

The schema is generated after the config failed to load, and the success line reads the same as
a healthy run. The dev server starts and serves normally.

## Why it matters

`drizzle-kit generate` reads that file. Run it after a dev session that hit this, and the
migration drops every column the module forgot.

The failure also self-heals across runs, so it looks intermittent. Delete `.nuxt` to see it
every time.

## Where it happens

`loadUserAuthConfig` catches the load failure and returns `{}` when `throwOnError` is false, and
`throwOnError` comes from `!nuxt.options.dev`. `setupBetterAuthSchema` then runs on that empty
object and overwrites the file.

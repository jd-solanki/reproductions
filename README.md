# Repro: `@nuxtjs/better-auth@0.2.3` no longer contributes its schema to NuxtHub

The module still generates its Drizzle schema. It just stops handing it to
`@nuxthub/core`, so `user`, `session`, `account` and `verification` vanish from
`@nuxthub/db/schema`. `0.2.2` does it correctly.

| | |
| --- | --- |
| `@nuxtjs/better-auth` | `0.2.2` works, `0.2.3` is broken |
| `better-auth` | 1.7.2 |
| `nuxt` | 4.5.2 |
| `@nuxthub/core` | 0.10.8 |
| `node` | v24.20.0 |

Those are resolved versions, printed by the run rather than copied from
`package.json`. They are at the top of the result block in [`repro.log`](./repro.log).

## Run it

```bash
npm install
npm run repro
```

Everything is automated in [`repro.mjs`](./repro.mjs). No dev server, no database,
no cloud account: both versions are measured from `nuxt prepare` and
`nuxt db generate` alone. It exits non-zero if the expected outcome is not
observed, so it doubles as a regression check.

## Mechanism

`@nuxtjs/better-auth` reaches NuxtHub's Drizzle schema through one hook. In
`setupBetterAuthSchema`, it listens for `hub:db:schema:extend` and pushes the path
of the file it generates:

```js
// node_modules/@nuxtjs/better-auth/dist/module.mjs, both versions
nuxtWithHubHooks.hook("hub:db:schema:extend", ({ paths, dialect: hookDialect }) => {
  const schemaPath = resolveHubSchemaPath(nuxt.options.buildDir, nuxt.options.rootDir, hookDialect);
  if (schemaPath)
    paths.unshift(schemaPath);
});
```

`@nuxthub/core` **calls** that hook from inside its own `modules:done` callback:

```js
// node_modules/@nuxthub/core/dist/module.mjs
nuxt.hook("modules:done", async () => {
  await generateDatabaseSchema(nuxt, hub);
  ...
});

// ... in generateDatabaseSchema:
await nuxt.callHook("hub:db:schema:extend", { dialect, paths: schemaPaths2 });
```

In `0.2.2` the module registered its listener during a normal `setup()`, which runs
while modules are still installing — before any `modules:done` callback:

```js
// @nuxtjs/better-auth@0.2.2 dist/module.mjs
async setup(options, nuxt) {
  const resolver = createResolver(import.meta.url);
  const nitroImports = resolveNitroCompatibilityImports(nuxt._version);
  ...
```

`0.2.3` moved the entire body of `setup()` inside `nuxt.hook('modules:done', ...)`:

```js
// @nuxtjs/better-auth@0.2.3 dist/module.mjs
setup(options, nuxt) {
  nuxt.hook("modules:done", async () => {
    const resolver = createResolver(import.meta.url);
    const nitroImports = resolveNitroCompatibilityImports(nuxt._version);
    ...
  });
}
```

`modules:done` callbacks fire in registration order. `@nuxthub/core` is listed
first in `modules`, so it registers first and runs first — it fires
`hub:db:schema:extend` before `@nuxtjs/better-auth` has registered a listener for
it. Nothing errors. The path is simply never contributed.

`0.2.3` did move the listener registration earlier *within*
`setupBetterAuthSchema` (before the `try`, rather than after the schema is
written). That does not help: the whole function is now called from a
`modules:done` callback that runs after the one that needed it.

## Symptom

After `nuxt prepare`, `.nuxt/hub/db/schema.entry.ts` holds one
`export * from '...'` per contributed schema path.

On `0.2.2`:

```ts
export * from '.nuxt/better-auth/schema.sqlite.ts'
```

On `0.2.3` the file is empty.

**The generated schema itself is fine under both versions.** `nuxt prepare` writes
`.nuxt/better-auth/schema.sqlite.ts` with all four tables in it either way, and
logs `Generated sqlite schema (.ts + .mjs)` either way. Only the wiring is lost.
That distinction matters when reading the module's own output: it looks like it
worked.

## Consequence: `nuxt db generate` writes a migration that drops the auth tables

`drizzle-kit` diffs the schema it can see against the migration history. Under
`0.2.3` it can see nothing, and says so (`0 tables`, in the log). The diff against
a history that already has the four tables then comes out as four drops.

The repro runs both `nuxt db generate` calls back to back against one migration
history, which is the ordinary upgrade path: an app on `0.2.2`, then `npm update`.

```
# 0000, generated on 0.2.2
CREATE TABLE `account` ... `session` ... `user` ... `verification`

# 0001, generated on 0.2.3 immediately after
DROP TABLE `account`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
DROP TABLE `verification`;
```

An upgrade plus a routine `nuxt db generate` produces a migration that deletes
every user account.

## Result

Real output from `npm run repro`. Full log in [`repro.log`](./repro.log).

```
=============== RESULT ===============
node          : v24.20.0
nuxt          : 4.5.2
@nuxthub/core : 0.10.8
better-auth   : 1.7.2
--------------------------------------
@nuxtjs/better-auth@0.2.2
  nuxt prepare / db generate    : exit 0 / 0
  generated the schema file     : true   (.nuxt/better-auth/schema.sqlite.ts)
  tables in it                  : user, session, account, verification
  contributes it to hub         : true
  .nuxt/hub/db/schema.entry.ts :
      export * from '.nuxt/better-auth/schema.sqlite.ts'
  new migration                 : 0000_living_the_captain.sql
    CREATE TABLE                : user, session, account, verification
    DROP TABLE                  : (none)
--------------------------------------
@nuxtjs/better-auth@0.2.3
  nuxt prepare / db generate    : exit 0 / 0
  generated the schema file     : true   (.nuxt/better-auth/schema.sqlite.ts)
  tables in it                  : user, session, account, verification
  contributes it to hub         : false
  .nuxt/hub/db/schema.entry.ts :
      (empty -- no schema paths at all)
  new migration                 : 0001_youthful_silver_samurai.sql
    CREATE TABLE                : (none)
    DROP TABLE                  : user, session, account, verification
--------------------------------------
0.2.2 contributes the schema path (expected true)  : true
0.2.3 contributes the schema path (expected false) : false
both versions still GENERATE the schema file       : true
0.2.2 migration creates all four tables            : true
0.2.3 migration DROPS all four tables              : true
BUG REPRODUCED                                     : true
======================================
```

The repro leaves the checkout on `0.2.3`, the broken state. `.nuxt` and
`server/db/migrations` are both git-ignored, so re-running it is safe.

## What the app is

As small as it gets: `@nuxthub/core` and `@nuxtjs/better-auth` in
[`nuxt.config.ts`](./nuxt.config.ts) with `hub.db: 'sqlite'`,
`emailAndPassword: { enabled: true }` in [`server/auth.config.ts`](./server/auth.config.ts),
and an empty client config the module insists on. No `hubSecondaryStorage` — that
is a different bug and does not belong here.

Module order in `nuxt.config.ts` is what the bug turns on, and it is the ordinary
order. `@nuxtjs/better-auth` is the module that plugs into NuxtHub, so NuxtHub goes
first.

## Notes for anyone running this

- `repro.mjs` writes `.nuxtrc` before each `nuxt prepare`. `@nuxt/kit` runs a
  module's `onInstall` lifecycle hook unless `.nuxtrc` already records a version
  for it (`callLifecycleHooks` in `@nuxt/kit/dist/index.mjs`), and this module's
  `onInstall` prompts for a secret. Stamping the version keeps the run
  non-interactive.
- It also pins `NUXT_BETTER_AUTH_SECRET`, for the same reason.
- Absolute paths in the entry file are shortened to repo-relative in the printed
  output. The match is on the substring `better-auth/schema.`, so it is unaffected.

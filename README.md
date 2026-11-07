# Repro: prerendered `llms.txt` drops page titles and descriptions when the database is off

A two-page static app with `nuxt-ai-ready` on its defaults. Both pages set a title and description,
and the prerender stores them, but `/llms.txt` lists each page by its bare path.

| | |
| --- | --- |
| Upstream | https://github.com/harlan-zw/nuxt-ai-ready/issues/234 |
| `nuxt-ai-ready` | 3.5.0 |
| `nuxt` | 4.6.4 |
| `node` / `pnpm` | 24.20.0 / 9.15.4 |

## Run it

```bash
pnpm install
pnpm repro
```

## Expected

```txt
- [About page](https://example.com/about.md): The about page description.
```

## Actual

```txt
llms.txt line for /about: - [/about](https://example.com/about.md)
FAIL: /llms.txt lists /about without its stored title and description
```

The same build's `.output/public/__ai-ready/pages.json` and `llms-full.txt` both carry
`About page` and its description.

## Cause

With no `aiReady.database` option and no feature that needs one, `resolveDatabaseConfig` resolves
the database to `Disabled`. `buildLlmsTxtFiles` (`src/runtime/llms-txt-utils.ts`) then skips the
metadata read entirely:

```ts
if (aiReadyConfig.database?._tag !== 'Disabled') {
  // queryPageMetadata(...)
}
```

During prerender `getDb` never touches the runtime database. It reads the build's `build.db`
through `getPrerenderDb`, which is populated either way, so the guard throws away metadata that
is available.

## Control

Install `drizzle-orm@1.0.0-rc.4` and uncomment `aiReady: { database: { type: 'sqlite' } }` in
`nuxt.config.ts`. `pnpm repro` then prints `PASS`.

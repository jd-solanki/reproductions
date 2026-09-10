import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Two ways of naming the same two layers. `REPRO_EXTENDS=path` swaps every reference in
// this repro (here and in `packages/b`) from the package name to the relative directory.
// The graph is identical either way; only the spelling changes.
const byPath = process.env.REPRO_EXTENDS === 'path'

export default defineNuxtConfig({
  // The diamond: layer A is reached directly, and again through layer B.
  //
  //   app ─────────────► @repro/layer-a
  //    │                       ▲
  //    └──► @repro/layer-b ────┘
  extends: byPath
    ? ['./packages/a', './packages/b']
    : ['@repro/layer-a', '@repro/layer-b'],

  compatibilityDate: '2026-09-10',
  nitro: {
    preset: 'cloudflare_module',
    // Makes nitro emit `.output/server/wrangler.json`. Without it `writeWranglerConfig`
    // returns immediately and there is nothing to inspect.
    cloudflare: { deployConfig: true, nodeCompat: true },
  },

  modules: [
    // Dumps the merged config next to the layer list Nuxt ended up with, so the two can be
    // compared. Runs after `loadNuxtConfig` has fully resolved both.
    (_options, nuxt) => {
      writeFileSync(
        join(nuxt.options.rootDir, '.repro-merged.json'),
        JSON.stringify(
          {
            layerCwds: nuxt.options._layers.map(l => l.cwd),
            crons: nuxt.options.nitro.cloudflare?.wrangler?.triggers?.crons,
            scheduledTasks: nuxt.options.nitro.scheduledTasks,
            nitroExternalsInline: nuxt.options.nitro.externals?.inline,
            importsDirs: nuxt.options.imports?.dirs,
          },
          null,
          2,
        ),
      )
    },
  ],
})

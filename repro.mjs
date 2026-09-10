// Builds the app twice — once with the layers named by package, once by relative path — and
// prints what came out: the merged Nuxt config, the layer list Nuxt kept, the wrangler
// `triggers` block, and the scheduled-task list baked into the server bundle.
//
// Exits non-zero unless the expected outcome is observed, so it doubles as a regression check.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = import.meta.dirname

// Read from disk rather than `require`: c12 and defu do not export `./package.json`.
const version = name =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version

function build(style) {
  rmSync(join(root, '.output'), { recursive: true, force: true })
  rmSync(join(root, '.nuxt'), { recursive: true, force: true })
  execFileSync('npx', ['nuxt', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, REPRO_EXTENDS: style },
  })
  return {
    // Written by the inline module in nuxt.config.ts, after the config is fully resolved.
    merged: JSON.parse(readFileSync(join(root, '.repro-merged.json'), 'utf8')),
    wrangler: JSON.parse(readFileSync(join(root, '.output', 'server', 'wrangler.json'), 'utf8')),
    // The bundle is minified, so match the emitted literal rather than parsing it.
    scheduled: readFileSync(join(root, '.output', 'server', 'chunks', 'nitro', 'nitro.mjs'), 'utf8')
      .match(/cron:"[^"]+",tasks:\[[^\]]*]/)?.[0] ?? '(none)',
  }
}

const byPackage = build('package')
const byPath = build('path')

const crons = b => b.wrangler.triggers?.crons ?? []
const authored = ['0 0 * * *']
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const short = paths => paths.map(p => basename(p ?? '')).join(', ')
const dup = a => a.length !== new Set(a).size

const duplicated = crons(byPackage).length > authored.length
const pathIsClean = eq(crons(byPath), authored)

// The layer list Nuxt reports is deduped even in the failing run. That is the trap: the
// duplication is invisible in `_layers` and visible only in the merged values.
const layersLookClean = !dup(byPackage.merged.layerCwds)

console.log(`
=============== RESULT ===============
node       : ${process.version}
nuxt       : ${version('nuxt')}
nitropack  : ${version('nitropack')}
c12        : ${version('c12')}
defu       : ${version('defu')}
--------------------------------------
authored once, in packages/a/nuxt.config.ts:
  nitro.cloudflare.wrangler.triggers.crons = ${JSON.stringify(authored)}
  nitro.scheduledTasks                     = {"0 0 * * *":["someTask"]}
  nitro.externals.inline                   = ["some-package"]
  imports.dirs                             = [".../packages/a/utils"]
======================================
extends: ['@repro/layer-a', '@repro/layer-b']     <- package names
--------------------------------------
  nuxt.options._layers (cwd)               : ${short(byPackage.merged.layerCwds)}
  ^ deduped: the repeat is NOT visible here
  merged nitro...triggers.crons            : ${JSON.stringify(byPackage.merged.crons)}
  merged nitro.scheduledTasks              : ${JSON.stringify(byPackage.merged.scheduledTasks)}
  merged nitro.externals.inline            : ${JSON.stringify(byPackage.merged.nitroExternalsInline)}
  merged imports.dirs (count / unique)     : ${byPackage.merged.importsDirs?.length} / ${new Set(byPackage.merged.importsDirs).size}
  .output/server/wrangler.json "triggers"  : ${JSON.stringify(byPackage.wrangler.triggers)}
  .output/server/.../nitro.mjs             : ${byPackage.scheduled}
======================================
extends: ['./packages/a', './packages/b']         <- same graph, relative paths
--------------------------------------
  nuxt.options._layers (cwd)               : ${short(byPath.merged.layerCwds)}
  merged nitro...triggers.crons            : ${JSON.stringify(byPath.merged.crons)}
  merged nitro.scheduledTasks              : ${JSON.stringify(byPath.merged.scheduledTasks)}
  merged nitro.externals.inline            : ${JSON.stringify(byPath.merged.nitroExternalsInline)}
  merged imports.dirs (count / unique)     : ${byPath.merged.importsDirs?.length} / ${new Set(byPath.merged.importsDirs).size}
  .output/server/wrangler.json "triggers"  : ${JSON.stringify(byPath.wrangler.triggers)}
  .output/server/.../nitro.mjs             : ${byPath.scheduled}
======================================
package-name extends duplicates the cron   (expected true) : ${duplicated}
... and the scheduledTasks task list       (expected true) : ${dup(byPackage.merged.scheduledTasks['0 0 * * *'])}
... while _layers still looks deduped      (expected true) : ${layersLookClean}
relative-path extends does none of it      (expected true) : ${pathIsClean}
BUG REPRODUCED                                             : ${duplicated && pathIsClean}
======================================
`)

process.exit(duplicated && pathIsClean ? 0 : 1)

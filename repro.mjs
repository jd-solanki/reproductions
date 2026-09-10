// Builds the app twice — once with the layers named by package, once by relative path — and
// prints what nitro generated each time: the wrangler `triggers` block, and the scheduled-task
// list baked into the server bundle.
//
// Exits non-zero unless the expected outcome is observed, so it doubles as a regression check.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

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

const duplicated = !eq(crons(byPackage), authored) && crons(byPackage).length > authored.length
const pathIsClean = eq(crons(byPath), authored)

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
--------------------------------------
extends: ['@repro/layer-a', '@repro/layer-b']     <- package names
  .output/server/wrangler.json  "triggers" : ${JSON.stringify(byPackage.wrangler.triggers)}
  .output/server/.../nitro.mjs             : ${byPackage.scheduled}

extends: ['./packages/a', './packages/b']         <- same graph, relative paths
  .output/server/wrangler.json  "triggers" : ${JSON.stringify(byPath.wrangler.triggers)}
  .output/server/.../nitro.mjs             : ${byPath.scheduled}
--------------------------------------
package-name extends duplicates the cron (expected true) : ${duplicated}
relative-path extends does not              (expected true) : ${pathIsClean}
BUG REPRODUCED                                              : ${duplicated && pathIsClean}
======================================
`)

process.exit(duplicated && pathIsClean ? 0 : 1)

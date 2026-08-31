// One-command reproduction. Run with: npm run repro
//
// Installs @nuxtjs/better-auth 0.2.2, then 0.2.3, and under each runs a cold
// `nuxt prepare` followed by `nuxt db generate`. Two things get read back:
//
//   1. .nuxt/hub/db/schema.entry.ts -- one `export * from '...'` per schema path
//      contributed to NuxtHub. This is the direct read of whether the module's
//      `hub:db:schema:extend` listener was registered in time.
//   2. server/db/migrations/sqlite/*.sql -- what falls out of that. 0.2.2 lays
//      the four auth tables down; 0.2.3, run straight after against the same
//      migration history, writes a migration that drops them again.
//
// Nothing here is a network call or a running server. Both versions are read
// off `nuxt prepare` alone.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'

// Order matters: 0.2.2 goes first so that its migration is the baseline the
// 0.2.3 run diffs against. That is the ordinary upgrade path -- a working app
// on 0.2.2, then `npm update`.
const VERSIONS = ['0.2.2', '0.2.3']

// What @nuxthub/core writes: one `export * from '...'` per contributed schema
// path. The module's own path is the only one this app could contribute -- it
// has no server/db/schema.ts of its own -- so the entry file reads as a yes/no.
const ENTRY_FILE = '.nuxt/hub/db/schema.entry.ts'

// The schema the module generates, independently of any hub wiring. It is
// written by a plain writeFile plus addTemplate, so it is expected to exist
// under BOTH versions. That is the point: nothing fails to generate.
const SCHEMA_FILE = '.nuxt/better-auth/schema.sqlite.ts'

const MIGRATIONS_DIR = 'server/db/migrations/sqlite'
const TABLES = ['user', 'session', 'account', 'verification']

// The module refuses to boot in production without a secret and generates one
// into a dotfile otherwise. Pinning it keeps the run hermetic.
const BASE_ENV = { NUXT_BETTER_AUTH_SECRET: 'repro-secret-not-a-real-one-0123456789' }

function run(cmd, args, { timeoutMs = 600000 } = {}) {
  return new Promise((resolve) => {
    // One string rather than (cmd, args) because Node deprecates the argv form
    // under `shell: true` (DEP0190). Nothing here is user input.
    const child = spawn([cmd, ...args].join(' '), { shell: true, detached: true, env: { ...process.env, ...BASE_ENV } })
    let out = ''
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch {} }
      resolve({ out, code: 'timeout' })
    }, timeoutMs)
    const onData = (buf) => { out += buf.toString(); process.stdout.write(buf) }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ out, code }) })
  })
}

// Read straight off disk rather than through `require.resolve`: several of
// these packages do not export their own package.json.
const installed = (name) => {
  try { return JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version } catch { return 'unknown' }
}

const migrations = () => (existsSync(MIGRATIONS_DIR) ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort() : [])

async function measure(version, { wipeMigrations }) {
  console.log(`\n=== @nuxtjs/better-auth@${version} ===\n`)

  // `--save-exact` so the two runs pin rather than float, and so the state the
  // repro leaves behind is the exact version it was last measured on.
  const install = await run('npm', ['install', `@nuxtjs/better-auth@${version}`, '--save-exact', '--no-audit', '--no-fund'])
  if (install.code !== 0)
    return { version, error: `npm install exited ${install.code}` }

  // `@nuxt/kit` runs a module's `onInstall` lifecycle hook unless .nuxtrc
  // already records a version for it, and this module's `onInstall` prompts.
  // Stamping the version just installed keeps every prepare non-interactive
  // and identical across the two runs.
  writeFileSync('.nuxtrc', `setups.@nuxtjs/better-auth="${version}"\n`)

  // Cold every time. A warm .nuxt would carry the previous version's
  // schema.entry.ts and the second run would read the first run's answer.
  rmSync('.nuxt', { recursive: true, force: true })

  // The migration history is wiped once, before the first version, and then
  // deliberately carried forward -- the damage only shows as a diff against
  // what the previous version already wrote.
  if (wipeMigrations) rmSync('server/db/migrations', { recursive: true, force: true })

  const before = migrations()
  const prepare = await run('npx', ['nuxt', 'prepare'])

  const entry = existsSync(ENTRY_FILE) ? readFileSync(ENTRY_FILE, 'utf8') : null
  const lines = (entry ?? '')
    .split('\n')
    .map((l) => l.trim())
    // The paths hub writes are absolute. Shortened for the log only; the match
    // below is on the substring `better-auth/schema.`, which survives either way.
    .map((l) => l.replaceAll(`${process.cwd()}/`, ''))
    .filter(Boolean)

  const generate = await run('npx', ['nuxt', 'db', 'generate'])
  const added = migrations().filter((f) => !before.includes(f))
  const sql = added.map((f) => readFileSync(`${MIGRATIONS_DIR}/${f}`, 'utf8')).join('\n')
  const stmt = (verb, table) => new RegExp(`${verb}\\s+\`?${table}\`?`, 'i').test(sql)

  return {
    version,
    prepareCode: prepare.code,
    generateCode: generate.code,
    // The resolved versions of everything that matters, read after the install
    // rather than guessed, so the README's table cannot drift from the run.
    resolved: {
      betterAuthModule: installed('@nuxtjs/better-auth'),
      betterAuth: installed('better-auth'),
      nuxt: installed('nuxt'),
      nuxtHubCore: installed('@nuxthub/core'),
    },
    entryExists: entry !== null,
    entryLines: lines,
    // The wiring: did the module's path make it into hub's schema barrel?
    schemaPathContributed: lines.some((l) => l.includes('better-auth/schema.')),
    // The generation: was the schema file itself produced? Expected true for both.
    schemaFileGenerated: existsSync(SCHEMA_FILE),
    // If the file is there, the four core tables are in it. Reported so that
    // "the tables are missing from @nuxthub/db/schema" is traceable to the
    // wiring rather than to an empty or partial generated file.
    tablesInSchemaFile: existsSync(SCHEMA_FILE)
      ? TABLES.filter((t) => new RegExp(`sqliteTable\\(\\s*["']${t}["']`).test(readFileSync(SCHEMA_FILE, 'utf8')))
      : [],
    newMigrations: added,
    created: TABLES.filter((t) => stmt('CREATE TABLE', t)),
    dropped: TABLES.filter((t) => stmt('DROP TABLE', t)),
  }
}

const results = []
for (const [i, version] of VERSIONS.entries())
  results.push(await measure(version, { wipeMigrations: i === 0 }))

const [v222, v223] = results

console.log('\n=============== RESULT ===============')
console.log(`node          : ${process.version}`)
console.log(`nuxt          : ${v222?.resolved.nuxt}`)
console.log(`@nuxthub/core : ${v222?.resolved.nuxtHubCore}`)
console.log(`better-auth   : ${v222?.resolved.betterAuth}`)
for (const r of results) {
  console.log('--------------------------------------')
  console.log(`@nuxtjs/better-auth@${r.resolved?.betterAuthModule ?? r.version}`)
  if (r.error) { console.log(`  ERROR: ${r.error}`); continue }
  console.log(`  nuxt prepare / db generate    : exit ${r.prepareCode} / ${r.generateCode}`)
  console.log(`  generated the schema file     : ${r.schemaFileGenerated}   (${SCHEMA_FILE})`)
  console.log(`  tables in it                  : ${r.tablesInSchemaFile.join(', ') || '(none)'}`)
  console.log(`  contributes it to hub         : ${r.schemaPathContributed}`)
  console.log(`  ${ENTRY_FILE} :${r.entryExists ? '' : ' (missing)'}`)
  if (r.entryLines.length) for (const line of r.entryLines) console.log(`      ${line}`)
  else if (r.entryExists) console.log('      (empty -- no schema paths at all)')
  console.log(`  new migration                 : ${r.newMigrations.join(', ') || '(none)'}`)
  console.log(`    CREATE TABLE                : ${r.created.join(', ') || '(none)'}`)
  console.log(`    DROP TABLE                  : ${r.dropped.join(', ') || '(none)'}`)
}
console.log('--------------------------------------')

const wiring = v222?.schemaPathContributed === true && v223?.schemaPathContributed === false
const generatedBoth = v222?.schemaFileGenerated === true && v223?.schemaFileGenerated === true
const consequence = v222?.created.length === TABLES.length && v223?.dropped.length === TABLES.length
const reproduced = wiring && generatedBoth && consequence

console.log(`0.2.2 contributes the schema path (expected true)  : ${v222?.schemaPathContributed}`)
console.log(`0.2.3 contributes the schema path (expected false) : ${v223?.schemaPathContributed}`)
console.log(`both versions still GENERATE the schema file       : ${generatedBoth}`)
console.log(`0.2.2 migration creates all four tables            : ${v222?.created.length === TABLES.length}`)
console.log(`0.2.3 migration DROPS all four tables              : ${v223?.dropped.length === TABLES.length}`)
console.log(`BUG REPRODUCED                                     : ${reproduced}`)
console.log('======================================\n')

console.log(`Left installed on @nuxtjs/better-auth@${VERSIONS.at(-1)} -- the broken state.`)
console.log(`Inspect ${ENTRY_FILE} by hand: the better-auth line is not there.`)
console.log(`The generated schema still is: ${SCHEMA_FILE}. Only the wiring is gone.\n`)

if (!reproduced) {
  console.log('Did NOT observe the expected outcome. See the per-version block above.')
  process.exit(1)
}

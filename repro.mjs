// One-command reproduction. Run with: npm run repro
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'

const SCHEMA = '.nuxt/better-auth/schema.sqlite.ts'
const COLUMN = 'customField'

const hasColumn = () =>
  (existsSync(SCHEMA) ? readFileSync(SCHEMA, 'utf8') : '').includes(COLUMN)

// Ask the OS for a port nobody is using. `nuxt dev` silently shifts to another
// port when its own is taken, and an unrelated dev server on 3000 is enough to
// make this run talk to a stranger.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

// `detached: true` gives the child its own process group, so the negative pid
// takes the whole `npx -> nuxt -> nitro` tree down. Without it only the shell
// wrapper dies, the dev server is orphaned, and this script never exits.
function kill(child) {
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    try { child.kill('SIGKILL') } catch {}
  }
}

function run(cmd, args, { waitFor, timeoutMs = 240000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true, detached: true })
    let out = ''
    let settled = false
    const finish = (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      kill(child)
      resolve({ out, code })
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    const onData = (buf) => {
      out += buf.toString()
      process.stdout.write(buf)
      // Give the module a moment to finish writing the file it just announced.
      if (waitFor && out.includes(waitFor)) setTimeout(() => finish('matched'), 5000)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', finish)
  })
}

const port = await freePort()

console.log('\n=== STEP 1: working config, `nuxt prepare` ===\n')
rmSync('.nuxt', { recursive: true, force: true })
copyFileSync('server/auth.config.ts.good', 'server/auth.config.ts')
await run('npx', ['nuxt', 'prepare'])
const step1 = hasColumn()
console.log(`\n[step 1] schema file exists: ${existsSync(SCHEMA)}`)
console.log(`[step 1] contains "${COLUMN}": ${step1}`)

console.log(`\n=== STEP 2: same config, one unresolvable import, \`nuxt dev\` (port ${port}) ===\n`)
copyFileSync('server/auth.config.ts.broken', 'server/auth.config.ts')
await run('npx', ['nuxt', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
  waitFor: 'Generated sqlite schema',
})
const step2 = hasColumn()
console.log(`\n[step 2] schema file exists: ${existsSync(SCHEMA)}`)
console.log(`[step 2] contains "${COLUMN}": ${step2}`)

console.log('\n=== STEP 3: same broken config, `nuxt prepare` ===\n')
const prepare = await run('npx', ['nuxt', 'prepare'])

copyFileSync('server/auth.config.ts.good', 'server/auth.config.ts')

console.log('\n================ RESULT ================')
console.log(`step 1  prepare, config OK      -> ${COLUMN} present: ${step1}`)
console.log(`step 2  dev, config fails       -> ${COLUMN} present: ${step2}`)
console.log(`step 3  prepare, config fails   -> exit code: ${prepare.code}`)
console.log('========================================')
console.log(
  step1 && !step2
    ? '\nREPRODUCED: dev overwrote a correct schema with an incomplete one.\n'
    : '\nNOT REPRODUCED.\n',
)

process.exit(0)

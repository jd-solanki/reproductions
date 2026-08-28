// One-command reproduction. Run with: npm run repro
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs'

const SCHEMA = '.nuxt/better-auth/schema.sqlite.ts'
const COLUMN = 'customField'

const read = () => (existsSync(SCHEMA) ? readFileSync(SCHEMA, 'utf8') : null)
const hasColumn = () => (read() ?? '').includes(COLUMN)

function run(cmd, args, { waitFor, timeoutMs = 120000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true })
    let out = ''
    const done = (code) => {
      clearTimeout(timer)
      try { child.kill('SIGKILL') } catch {}
      resolve({ out, code })
    }
    const timer = setTimeout(() => done('timeout'), timeoutMs)
    const onData = (buf) => {
      out += buf.toString()
      process.stdout.write(buf)
      if (waitFor && out.includes(waitFor)) setTimeout(() => done('matched'), 3000)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', done)
  })
}

console.log('\n=== STEP 1: working config, `nuxt prepare` ===\n')
rmSync('.nuxt', { recursive: true, force: true })
copyFileSync('server/auth.config.ts.good', 'server/auth.config.ts')
await run('npx', ['nuxt', 'prepare'])
const step1 = hasColumn()
console.log(`\n[step 1] schema file exists: ${existsSync(SCHEMA)}`)
console.log(`[step 1] contains "${COLUMN}": ${step1}`)

console.log('\n=== STEP 2: same config, one unresolvable import, `nuxt dev` ===\n')
copyFileSync('server/auth.config.ts.broken', 'server/auth.config.ts')
await run('npx', ['nuxt', 'dev'], { waitFor: 'Schema may be incomplete' })
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

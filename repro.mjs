// One-command reproduction. Run with: npm run repro
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'

const SCHEMA = '.nuxt/better-auth/schema.sqlite.ts'
const has = (needle) => (existsSync(SCHEMA) ? readFileSync(SCHEMA, 'utf8') : '').includes(needle)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Ask the OS for a port nobody is using. Other dev servers on this machine may
// already hold 3000-3003, and `nuxt dev` silently shifts to the next free port
// when its own is taken -- which is how a probe ends up talking to a stranger.
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

function kill(child) {
  // `detached: true` gives the child its own process group, so the negative pid
  // takes the whole `npx -> nuxt -> nitro` tree down with it. Without it the
  // dev server outlives the run and squats the port for the next one.
  try { process.kill(-child.pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch {} }
}

function run(cmd, args, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true, detached: true })
    let out = ''
    const timer = setTimeout(() => { kill(child); resolve({ out, code: 'timeout' }) }, timeoutMs)
    const onData = (buf) => { out += buf.toString(); process.stdout.write(buf) }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ out, code }) })
  })
}

// Starts `nuxt dev`, waits until it genuinely serves a page, then probes.
function runDev(port, probe, { timeoutMs = 300000, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['nuxt', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
      shell: true,
      detached: true,
      env: { ...process.env, ...env },
    })
    let out = ''
    let started = false
    let settled = false

    const finish = (extra) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      kill(child)
      resolve({ out, extra })
    }
    const timer = setTimeout(() => finish({ error: 'dev server timed out' }), timeoutMs)

    const onData = async (buf) => {
      out += buf.toString()
      process.stdout.write(buf)
      // Only the banner tells us the port it settled on. Bail loudly if it moved.
      const m = out.match(/Local:\s+https?:\/\/[^:]+:(\d+)/)
      if (!started && m) {
        started = true
        const actual = Number(m[1])
        if (actual !== port) return finish({ error: `nuxt moved to port ${actual}, expected ${port}` })
        finish(await probe(`http://127.0.0.1:${actual}`).catch((e) => ({ error: String(e) })))
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', () => finish({ error: 'dev server exited before it was ready' }))
  })
}

// Poll until `ok(status)` holds. `nuxt dev` builds lazily on first request and
// answers 503 "restarting" while it does, so the first few tries are expected
// to fail and the budget has to outlast a cold build.
async function poll(url, ok, tries = 120) {
  let last = null
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      last = res.status
      if (ok(res.status)) return res
    } catch (e) { last = String(e.cause?.code ?? e.message) }
    await sleep(1000)
  }
  return { status: last, text: async () => `gave up after ${tries} tries, last: ${last}`, gaveUp: true }
}

console.log('\n=== STEP 1: `nuxt prepare` -- what reached schema generation? ===\n')
rmSync('.nuxt', { recursive: true, force: true })
await run('npx', ['nuxt', 'prepare'])
const pluginField = has('viaPluginField')
const hookField = has('viaHookField')

// Probes one running dev server: warm it up, check the control, then ask for
// the endpoint the demo plugin carries.
const probe = async (base) => {
  // 1. Warm up. Nuxt compiles the app on the first request; until that lands
  //    every route answers 503, including the ones under test. Any status other
  //    than 503 means the build finished -- this app has no pages, so `/`
  //    settles on a legitimate 404.
  const warm = await poll(`${base}/`, (s) => s !== 503)
  // 2. Control. `get-session` is a built-in Better Auth route. If it answers a
  //    real status the handler is mounted, so a 404 on demo-ping means the
  //    endpoint is missing rather than the server being down.
  const control = await poll(`${base}/api/auth/get-session`, (s) => s !== 503)
  // 3. The endpoint carried by the plugin contributed through the hook.
  const ping = await fetch(`${base}/api/auth/demo-ping`)
  return {
    warmup: warm.status,
    control: { status: control.status, body: (await control.text()).slice(0, 80) },
    demoPing: { status: ping.status, body: (await ping.text()).slice(0, 80) },
  }
}

console.log('\n=== STEP 2: `nuxt dev` -- did the plugin reach the runtime instance? ===\n')
const port2 = await freePort()
console.log(`[repro] using port ${port2}\n`)
const viaHook = (await runDev(port2, probe)).extra ?? {}

console.log('\n=== STEP 3: positive control -- same plugin, declared in auth.config.ts ===\n')
const port3 = await freePort()
console.log(`[repro] using port ${port3}\n`)
rmSync('.nuxt', { recursive: true, force: true })
const viaConfig = (await runDev(port3, probe, { env: { REPRO_DIRECT: '1' } })).extra ?? {}

const line = (label, e) =>
  `${label.padEnd(28)}: warmup ${String(e.warmup ?? e.error).padEnd(5)}`
  + ` control ${String(e.control?.status ?? '-').padEnd(5)}`
  + ` demo-ping ${e.demoPing?.status ?? '-'}`

console.log('\n================ RESULT ================')
console.log(`schema has "viaPluginField" (set via hook config.plugins)   : ${pluginField}`)
console.log(`schema has "viaHookField"   (set via hook config.user.*)    : ${hookField}`)
console.log(line('step 2  plugin via hook', viaHook))
console.log(line('step 3  plugin via config', viaConfig))
console.log('----------------------------------------')
console.log(`step 2  control body   : ${JSON.stringify(viaHook.control?.body)}`)
console.log(`step 2  demo-ping body : ${JSON.stringify(viaHook.demoPing?.body)}`)
console.log(`step 3  control body   : ${JSON.stringify(viaConfig.control?.body)}`)
console.log(`step 3  demo-ping body : ${JSON.stringify(viaConfig.demoPing?.body)}`)
console.log('========================================')
console.log(
  pluginField && !hookField
    ? '\n(A) CONFIRMED: only `plugins` survived the hook; `user.additionalFields` was dropped.'
    : '\n(A) NOT reproduced.',
)
console.log(
  viaConfig.demoPing?.status === 200 && viaHook.control?.status === 200 && viaHook.demoPing?.status === 404
    ? '(B) CONFIRMED: the same plugin serves 200 when declared in auth.config.ts,'
      + ' but 404 when contributed through the hook.\n'
    : `(B) inconclusive: ${viaHook.error ?? viaConfig.error ?? 'see statuses above'}\n`,
)

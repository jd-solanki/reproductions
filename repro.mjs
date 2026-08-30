// One-command reproduction. Run with: npm run repro
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'

const STORAGE_FILE = '.nuxt/better-auth/secondary-storage.mjs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The module refuses to boot in production without a secret and generates one
// into a dotfile otherwise. Pinning it keeps the run hermetic.
const BASE_ENV = { NUXT_BETTER_AUTH_SECRET: 'repro-secret-not-a-real-one-0123456789' }

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

function run(cmd, args, { timeoutMs = 300000, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true, detached: true, env: { ...process.env, ...BASE_ENV, ...env } })
    let out = ''
    const timer = setTimeout(() => { kill(child); resolve({ out, code: 'timeout' }) }, timeoutMs)
    const onData = (buf) => { out += buf.toString(); process.stdout.write(buf) }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ out, code }) })
  })
}

// Starts `nuxt dev`, waits until it genuinely serves a page, then probes.
// Resolves with the probe result AND everything the server logged, because the
// interesting half of both symptoms is a stack trace on stderr rather than
// anything better-auth puts in the 500 response body.
function runDev(port, probe, { timeoutMs = 300000, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['nuxt', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
      shell: true,
      detached: true,
      env: { ...process.env, ...BASE_ENV, ...env },
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
        const result = await probe(`http://127.0.0.1:${actual}`).catch((e) => ({ error: String(e) }))
        // Give the server a beat to flush the stack trace it is mid-way through
        // printing, so the assertions below can read it.
        await sleep(1500)
        finish(result)
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

const body = async (res) => (await res.text()).replace(/\s+/g, ' ').slice(0, 160)

// Node's fetch sends `sec-fetch-mode: cors` and no `Origin`, which Better Auth
// rejects with 403 MISSING_OR_NULL_ORIGIN before any handler runs. Sending the
// origin we are actually talking to is what a browser would do.
const asBrowser = (base, extra = {}) => ({ origin: base, ...extra })

// Drives magic link end to end: request a link, read it out of the repro's
// stand-in inbox, then follow it. `magic-link/verify` is the only route in the
// flow that consumes a verification value, which is the operation that needs
// `SecondaryStorage.getAndDelete`.
const probeMagicLink = async (base) => {
  // 1. Warm up. Nuxt compiles the app on the first request; until that lands
  //    every route answers 503, including the ones under test. Any status other
  //    than 503 means the build finished -- this app has no pages, so `/`
  //    settles on a legitimate 404.
  const warm = await poll(`${base}/`, (s) => s !== 503)
  // 2. Control. `get-session` is a built-in Better Auth route, so a real status
  //    from it means the handler is mounted and a later 500 is about the code
  //    path rather than about a server that never came up.
  const control = await poll(`${base}/api/auth/get-session`, (s) => s !== 503)
  // 3. Mint a link. This only writes to secondary storage, so it works either way.
  const signIn = await fetch(`${base}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: asBrowser(base, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email: 'repro@example.com' }),
  })
  const signInResult = { status: signIn.status, body: await body(signIn) }
  // 4. Read it out of the inbox.
  const inbox = await fetch(`${base}/__repro/magic-link`).then((r) => r.json()).catch(() => ({}))
  // 5. Follow it. The link is minted against the server's own inferred base URL
  //    (`localhost`), so only its path and query are reused, against the port we
  //    know we started. The probe cannot end up talking to a different server.
  let verify = { status: '-', body: '', location: null, session: false }
  if (inbox?.url) {
    const link = new URL(inbox.url)
    const res = await fetch(new URL(link.pathname + link.search, base), {
      redirect: 'manual',
      headers: asBrowser(base),
    })
    verify = {
      status: res.status,
      // On success the handler redirects to the callback URL. On a handled
      // failure it redirects to the same place with `?error=`, so the location
      // is what separates the two.
      location: res.headers.get('location'),
      session: (res.headers.get('set-cookie') ?? '').includes('session_token'),
      body: await body(res),
    }
  }
  return { warmup: warm.status, control: { status: control.status, body: await body(control) }, signIn: signInResult, linkCaptured: Boolean(inbox?.url), verify }
}

// Drives rate limiting: one ordinary auth request, with `rateLimit.enabled`
// forced on. Nothing here is exotic -- every request to every auth route goes
// through the same check.
const probeRateLimit = async (base) => {
  const warm = await poll(`${base}/`, (s) => s !== 503)
  // Liveness control. Rate limiting breaks every route under /api/auth, so the
  // proof that the server is up has to come from a route better-auth does not
  // own. This one is ours, from server/routes/__repro/.
  const own = await poll(`${base}/__repro/magic-link`, (s) => s !== 503)
  const session = await fetch(`${base}/api/auth/get-session`)
  return { warmup: warm.status, ownRoute: own.status, getSession: { status: session.status, body: await body(session) } }
}

const wipeBuild = () => rmSync('.nuxt', { recursive: true, force: true })

console.log('\n=== STEP 0: what does the module actually generate? ===\n')
wipeBuild()
rmSync('.data', { recursive: true, force: true })
rmSync('server/db/migrations', { recursive: true, force: true })
await run('npx', ['nuxt', 'prepare'])

const generated = existsSync(STORAGE_FILE) ? readFileSync(STORAGE_FILE, 'utf8') : ''
console.log(`\n[repro] ${STORAGE_FILE}:\n${generated}\n`)
const methods = Object.fromEntries(
  ['get', 'set', 'delete', 'getAndDelete', 'increment'].map((m) => [m, new RegExp(`\\b${m}\\s*:`).test(generated)]),
)

// The generated Drizzle schema has to reach the database before magic link can
// create a user. `nuxt db generate` writes the migrations; `nuxt dev` applies
// them on startup. Generated once, under the default config, and reused by
// every step -- regenerating under `hubSecondaryStorage: 'custom'` would drop
// the session table and turn the control into a second variable.
console.log('\n=== STEP 0b: generate the database migrations ===\n')
await run('npx', ['nuxt', 'db', 'generate'])

console.log('\n=== STEP A1: magic link, on the storage the module generates ===\n')
const portA1 = await freePort()
console.log(`[repro] using port ${portA1}\n`)
wipeBuild()
const a1 = await runDev(portA1, probeMagicLink)

console.log('\n=== STEP A2: control -- same flow, hubSecondaryStorage: "custom" ===\n')
const portA2 = await freePort()
console.log(`[repro] using port ${portA2}\n`)
wipeBuild()
const a2 = await runDev(portA2, probeMagicLink, { env: { REPRO_STORAGE: 'custom' } })

console.log('\n=== STEP B1: rate limiting, on the storage the module generates ===\n')
const portB1 = await freePort()
console.log(`[repro] using port ${portB1}\n`)
wipeBuild()
const b1 = await runDev(portB1, probeRateLimit, { env: { REPRO_RATE_LIMIT: '1' } })

console.log('\n=== STEP B2: control -- same request, hubSecondaryStorage: "custom" ===\n')
const portB2 = await freePort()
console.log(`[repro] using port ${portB2}\n`)
wipeBuild()
const b2 = await runDev(portB2, probeRateLimit, { env: { REPRO_RATE_LIMIT: '1', REPRO_STORAGE: 'custom' } })

const GET_AND_DELETE_ERROR = 'getAndDelete is not a function'
const INCREMENT_ERROR = 'Secondary-storage rate limiting requires SecondaryStorage.increment'

const a1p = a1.extra ?? {}
const a2p = a2.extra ?? {}
const b1p = b1.extra ?? {}
const b2p = b2.extra ?? {}

const a1Logged = a1.out.includes(GET_AND_DELETE_ERROR)
const a2Logged = a2.out.includes(GET_AND_DELETE_ERROR)
const b1Logged = b1.out.includes(INCREMENT_ERROR)
const b2Logged = b2.out.includes(INCREMENT_ERROR)

// A verify redirect is a success only if it did not carry an error back and it
// set a session cookie on the way out.
const verified = (p) => p.verify?.status === 302 && !String(p.verify?.location).includes('error=') && p.verify?.session === true

const symptomA = a1p.verify?.status === 500 && a1Logged && verified(a2p) && !a2Logged
const symptomB = b1p.getSession?.status === 500 && b1Logged && b2p.getSession?.status === 200 && !b2Logged

console.log('\n======= RESULT =======')
console.log('generated .nuxt/better-auth/secondary-storage.mjs implements')
for (const [name, present] of Object.entries(methods))
  console.log(`  ${name.padEnd(13)}: ${present}`)
console.log('----------------------')
console.log('SYMPTOM A -- consuming a verification value (magic link verify)')
console.log(`  A1 module storage   : warmup ${a1p.warmup}  get-session ${a1p.control?.status}  sign-in ${a1p.signIn?.status}  link captured ${a1p.linkCaptured}  verify ${a1p.verify?.status}`)
console.log(`  A2 custom storage   : warmup ${a2p.warmup}  get-session ${a2p.control?.status}  sign-in ${a2p.signIn?.status}  link captured ${a2p.linkCaptured}  verify ${a2p.verify?.status}`)
console.log(`  A1 server logged "${GET_AND_DELETE_ERROR}" : ${a1Logged}`)
console.log(`  A2 server logged "${GET_AND_DELETE_ERROR}" : ${a2Logged}`)
console.log(`  A1 verify redirect  : ${a1p.verify?.location ?? '-'}   session cookie ${a1p.verify?.session}`)
console.log(`  A2 verify redirect  : ${a2p.verify?.location ?? '-'}   session cookie ${a2p.verify?.session}`)
console.log('----------------------')
console.log('SYMPTOM B -- every auth request, once rateLimit.enabled (production default)')
console.log(`  B1 module storage   : warmup ${b1p.warmup}  own route ${b1p.ownRoute}  get-session ${b1p.getSession?.status}`)
console.log(`  B2 custom storage   : warmup ${b2p.warmup}  own route ${b2p.ownRoute}  get-session ${b2p.getSession?.status}`)
console.log(`  B1 server logged "${INCREMENT_ERROR}." : ${b1Logged}`)
console.log(`  B2 server logged "${INCREMENT_ERROR}." : ${b2Logged}`)
console.log('----------------------')
console.log(`  A1 verify body      : ${JSON.stringify(a1p.verify?.body)}`)
console.log(`  A2 verify body      : ${JSON.stringify(a2p.verify?.body)}`)
console.log(`  B1 get-session body : ${JSON.stringify(b1p.getSession?.body)}`)
console.log(`  B2 get-session body : ${JSON.stringify(b2p.getSession?.body)}`)
console.log('----------------------')
console.log(`SYMPTOM A reproduced : ${symptomA}`)
console.log(`SYMPTOM B reproduced : ${symptomB}`)
console.log('======================\n')

if (!symptomA) console.log(`(A) inconclusive: ${a1p.error ?? a2p.error ?? 'see statuses above'}`)
if (!symptomB) console.log(`(B) inconclusive: ${b1p.error ?? b2p.error ?? 'see statuses above'}`)

// Starts `nuxt dev`, posts a JSON sign-in body, and fails when Better Auth reports the body missing.
import { spawn } from 'node:child_process'

const port = 3917
const dev = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(port)], {
  env: { ...process.env, NUXT_BETTER_AUTH_SECRET: 'repro-secret-repro-secret-repro-secret-1234' },
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
const stop = (code) => {
  try { process.kill(-dev.pid, 'SIGTERM') } catch {}
  process.exit(code)
}
setTimeout(() => { console.error('Timed out waiting for nuxt dev'); stop(2) }, 180_000)

let log = ''
const onData = async (chunk) => {
  log += chunk
  if (!/Nitro server built|Vite server built|Nuxt Nitro server built/.test(log) || onData.done) return
  onData.done = true
  // Retry until the first request after the build succeeds.
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: `http://localhost:${port}` },
        body: JSON.stringify({ email: 'a@example.com', password: 'password1234' }),
      })
      const text = await res.text()
      // Nuxt answers 503 with a loading page until the server is ready.
      if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('not ready')
      console.log(`POST /api/auth/sign-in/email -> ${res.status} ${text}`)
      stop(/"code":"VALIDATION_ERROR"/.test(text) && text.includes('[body]') ? 1 : 0)
      return
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  console.error('Server never answered')
  stop(2)
}
dev.stdout.on('data', onData)
dev.stderr.on('data', onData)

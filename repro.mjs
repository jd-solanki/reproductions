import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
})

let output = ''
const dev = spawn('node_modules/.bin/nuxt', ['dev', '--port', String(port)], {
  detached: true,
  env: { ...process.env, NO_COLOR: '1' },
})
dev.stdout.on('data', (chunk) => { output += chunk })
dev.stderr.on('data', (chunk) => { output += chunk })

const exited = new Promise(resolve => dev.on('exit', resolve))
async function stop(code) {
  process.kill(-dev.pid, 'SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))])
  try { process.kill(-dev.pid, 'SIGKILL') } catch {}
  process.exit(code)
}

const url = `http://localhost:${port}/api/hello`
let response
let body
for (const deadline = Date.now() + 120_000; Date.now() < deadline;) {
  await new Promise(resolve => setTimeout(resolve, 500))
  if (!output.includes('Ready in')) continue
  response = await fetch(url).catch(() => undefined)
  body = await response?.text()
  // Until the dev server is ready, Nuxt answers with its "Starting Nuxt" loading page.
  if (response && !body.includes('Starting Nuxt')) break
  response = undefined
}

if (!response) {
  console.log(`nuxt dev never became ready\n${output}`)
  await stop(1)
}

await new Promise(resolve => setTimeout(resolve, 500))
const firstError = output.split('\n').find(line => line.includes('Error:'))
console.log(`GET /api/hello -> ${response.status}`)
console.log(response.status === 200 ? body : `first error line: ${firstError?.trim() ?? '(none in dev output)'}`)
await stop(response.status === 200 ? 0 : 1)

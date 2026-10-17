import { execSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'

const documented = 'server/databases/migrations'
const misplaced = 'app/server/databases/migrations'

// Reset to the committed baseline so the script is re-runnable.
rmSync('app/server', { recursive: true, force: true })
execSync(`git checkout -- ${documented} && git clean -fdq ${documented}`)

execSync('pnpm exec vitehub db generate', { stdio: 'inherit' })

const sqlIn = dir => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.sql')) : []
console.log(`\n${documented}: ${sqlIn(documented).join(', ') || '(none)'}`)
console.log(`${misplaced}: ${existsSync(misplaced) ? sqlIn(misplaced).join(', ') : '(does not exist)'}`)

const failures = []
if (existsSync(misplaced)) failures.push(`migrations written to ${misplaced}`)
if (!sqlIn(documented).some(f => f.startsWith('0001_'))) failures.push(`no 0001_*.sql in ${documented}`)

if (failures.length) {
  console.error(`\nFAIL: ${failures.join('; ')}`)
  process.exit(1)
}
console.log(`\nPASS: 0001_*.sql written to ${documented}`)

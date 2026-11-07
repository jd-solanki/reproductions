// Fails while /llms.txt lists /about without the title and description the page sets.
import { readFileSync } from 'node:fs'

const llms = readFileSync('.output/public/llms.txt', 'utf8')
const line = llms.split('\n').find(l => l.includes('/about'))
console.log(`llms.txt line for /about: ${line}`)

if (!line?.includes('[About page]') || !line.includes('The about page description.')) {
  console.error('FAIL: /llms.txt lists /about without its stored title and description')
  process.exit(1)
}
console.log('PASS')

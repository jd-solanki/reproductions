import { readFileSync } from 'node:fs'

const dump = readFileSync('.output/public/__nuxt_content/content/sql_dump.txt', 'utf8')

if (dump.trimStart().startsWith('<')) {
  console.error('FAIL: sql_dump.txt is an HTML page, not the collection dump:')
  console.error(dump.slice(0, 200))
  process.exit(1)
}

console.log('OK: sql_dump.txt holds the compressed collection dump')

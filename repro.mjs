import { unstable_startWorker } from 'wrangler'

const worker = await unstable_startWorker({ config: 'wrangler.jsonc' })
const { error } = await (await worker.fetch('http://localhost/')).json()
await worker.dispose()

console.log('unemail error:', error)
// acme.com is on nobody's account, so a message the binding accepts stops at the sender check.
if (error?.includes("Incorrect type for the 'name' field")) process.exit(1)

const { db, schema } = await import('./.vitehub/database/cloudflare-runtime.mjs')

console.log('typeof db.query.notes:', typeof db.query.notes)
console.log('typeof schema.notes:', typeof schema.notes)
if (db.query.notes === undefined && schema.notes !== undefined) process.exit(1)

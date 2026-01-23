export default defineEventHandler(async (event) => {
  const body = await readRawBody(event)
  console.log('Received webhook payload:', body)
  
  const body2 = await readRawBody(event)
  console.log('Received webhook payload (2nd read):', body2)
    
  return { body, body2 }
})
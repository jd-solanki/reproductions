export default defineEventHandler(async (event) => {
  const rawBodyReadFirst = await readRawBody(event)
  console.log('rawBodyReadFirst:', rawBodyReadFirst)
  
  const rawBodyReadSecond = await readRawBody(event)
  console.log('rawBodyReadSecond:', rawBodyReadSecond)

  const readBodyFirst = await readBody(event)
  console.log('readBodyFirst:', readBodyFirst)
    
  return { rawBodyReadFirst, rawBodyReadSecond, readBodyFirst }
})
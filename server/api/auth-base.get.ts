// The base Better Auth builds every emailed link and OAuth `redirect_uri` from.
export default defineEventHandler(async (event) => {
  const auth = await serverAuth(event)
  return (await auth.$context).baseURL
})

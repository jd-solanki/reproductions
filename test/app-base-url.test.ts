import { fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup({ dev: true })

describe("Better Auth under app.baseURL '/app/'", () => {
  it('answers /app/api/auth/ok', async () => {
    expect((await fetch('/app/api/auth/ok')).status).toBe(200)
  })

  it('builds its links under /app/api/auth', async () => {
    const baseURL = await (await fetch('/app/api/auth-base')).text()
    expect(new URL(baseURL).pathname).toBe('/app/api/auth')
  })
})

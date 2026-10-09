import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup()

describe('compatibilityVersion 5 on Nitro 2', () => {
  it('auto-imports a shared/utils export in server code', async () => {
    expect(await $fetch('/api/greet')).toBe('hello nuxt')
  })

  it('keeps defineAppConfig for app.config.ts in the server bundle', async () => {
    expect(await $fetch('/api/title')).toBe('from app.config')
  })
})

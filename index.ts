import { polarClient } from '@polar-sh/better-auth/client'
import { createAuthClient } from 'better-auth/client'

const authClient = createAuthClient({
  plugins: [polarClient()],
})

authClient.checkout({ slug: 'pro' })

// Must fail with TS2339 on a typed client.
authClient.doesNotExist()

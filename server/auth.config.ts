import { defineServerAuth } from '@nuxtjs/better-auth/config'

// Nothing about the auth options is under test; email and password is the smallest valid config.
export default defineServerAuth({
  emailAndPassword: { enabled: true },
})

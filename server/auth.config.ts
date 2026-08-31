import { defineServerAuth } from '@nuxtjs/better-auth/config'

// The smallest config that still makes the module generate a Drizzle schema.
// Email and password alone produce the four core tables: user, session,
// account, verification.
export default defineServerAuth({
  emailAndPassword: { enabled: true },
})

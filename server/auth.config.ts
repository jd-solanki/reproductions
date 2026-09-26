import { defineServerAuth } from '@nuxtjs/better-auth/config'

// The smallest config that makes the module generate the core tables, `user` among them.
export default defineServerAuth({
  emailAndPassword: { enabled: true },
})

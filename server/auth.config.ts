import { defineServerAuth } from '@onmax/nuxt-better-auth/config'

export default defineServerAuth(({ runtimeConfig }) => ({
  emailAndPassword: { enabled: true },
  user: { additionalFields: { foo: { type: 'string', required: false } } },
  // EAGER read -> crashes at schema gen because runtimeConfig is {}
  appName: runtimeConfig.public.app.routes.signUp,
}))

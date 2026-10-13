import { defineServerAuth } from '@nuxtjs/better-auth/config'
import { admin } from 'better-auth/plugins'
// A `#server` import makes the module treat this config as unsafe for the shared program.
import { appName } from '#server/app.ts'

export default defineServerAuth({
  appName,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // `sendMail` is auto-imported from server/utils.
      await sendMail(user.email, url)
    },
  },
  plugins: [admin()],
})

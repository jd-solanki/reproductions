import { defineServerAuth } from '@nuxtjs/better-auth/config'

export default defineServerAuth(() => ({
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      customField: { type: 'string', required: false },
    },
  },
}))

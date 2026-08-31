import { defineClientAuth } from '@nuxtjs/better-auth/config'

// The module refuses to set up without a client config. Nothing here is under
// test; it exists so `nuxt prepare` gets far enough to generate the schema.
export default defineClientAuth({})

import { defineClientAuth } from '@nuxtjs/better-auth/config'

// Nothing under test lives on the client. Every step of the repro drives the
// server over plain HTTP.
export default defineClientAuth({})

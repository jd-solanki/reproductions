import { defineServerAuth } from '@nuxtjs/better-auth/config'
import { demoPlugin } from '../demo-module/plugin'

// Deliberately bare. Everything under test is contributed through the
// `better-auth:config:extend` hook in ../demo-module/index.ts.
//
// Step 3 of the repro sets REPRO_DIRECT=1, which declares the very same plugin
// here instead. That is the positive control: it shows the endpoint works when
// it arrives by the supported route, so the 404 in step 2 is about the hook and
// not about the plugin being malformed.
export default defineServerAuth(() => ({
  emailAndPassword: { enabled: true },
  ...(process.env.REPRO_DIRECT ? { plugins: [demoPlugin()] } : {}),
}))

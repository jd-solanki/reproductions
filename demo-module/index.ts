import { defineNuxtModule } from '@nuxt/kit'
import { demoPlugin } from './plugin'

export default defineNuxtModule({
  meta: { name: 'extend-auth-demo' },
  setup(_options, nuxt) {
    // Step 3 declares the plugin in server/auth.config.ts instead, so the hook
    // stands down to keep a single copy of it in play.
    if (process.env.REPRO_DIRECT) return

    nuxt.hook('better-auth:config:extend', (config) => {
      // The hook parameter is typed `Partial<BetterAuthOptions>`, so both of
      // these are valid to set.
      config.plugins = [demoPlugin()]
      config.user = {
        additionalFields: {
          viaHookField: { type: 'string', required: false },
        },
      }
    })
  },
})

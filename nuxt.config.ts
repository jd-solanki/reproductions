export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 5 },
  // Both keys are nitropack options: `preset` from its config types, `cloudflare` from its presets.
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: { deployConfig: true },
  },
})

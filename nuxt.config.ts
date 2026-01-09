
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  hooks: {
    'pages:resolved': function (pages) {
      const securePage = pages.find(page => page.path === '/secure')

      console.log('Secure Pages:', securePage)
      console.log('Secure Page Groups:', securePage.meta?.groups)

      // securePage.meta.groups is udefined

      // TODO: Add auth/private middleware to all pages having "private" group
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})

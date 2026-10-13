import { addTypeTemplate, defineNuxtModule } from 'nuxt/kit'

// Stands in for any module that types its route rule the way Nitro 3 documents: on the
// `RouteRuleConfig` that `nitro/types` re-exports.
export default defineNuxtModule({
  setup() {
    addTypeTemplate({
      filename: 'types/robots-rule.d.ts',
      getContents: () => `declare module 'nitro/types' {
  interface RouteRuleConfig {
    robots?: boolean
  }
}
export {}
`,
    }, { nuxt: true, nitro: true, node: true })
  },
})

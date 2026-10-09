// Nuxt's own helpers come in explicitly, as Nuxt 5 asks; `greet` is a `shared/utils` export, which
// the Nuxt 5 upgrade guide says stays auto-imported.
import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(() => greet('nuxt'))

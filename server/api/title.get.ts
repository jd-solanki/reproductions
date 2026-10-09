import { defineEventHandler, useAppConfig } from 'nuxt/server'

export default defineEventHandler((event) => useAppConfig(event).title)

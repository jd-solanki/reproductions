import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(() => renderEmailComponent('Welcome', { name: 'Nuxt 5' }))

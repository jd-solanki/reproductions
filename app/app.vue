<script setup lang="ts">
// `@nuxthub/db/schema` is NuxtHub's documented client-safe entry for sharing the DB
// schema with the Vue app (docs: Database > Schema > "Sharing types with Vue").
//
// Here we VALUE-import a table (not just its type) — the canonical use case is
// deriving a client form-validation schema from the Drizzle table via drizzle-zod,
// keeping a single source of truth for DB + client validation.
//
// This import alone makes `nuxt build` fail: the generated `@nuxthub/db/schema`
// bundle co-locates the `postgres` driver, which gets pulled into the CLIENT bundle.
import { todos } from '@nuxthub/db/schema'
import { createInsertSchema } from 'drizzle-zod'

const insertTodoSchema = createInsertSchema(todos)

// eslint-disable-next-line no-console
console.log('todo insert schema keys:', Object.keys(insertTodoSchema.shape))
</script>

<template>
  <div>
    See the build error — `@nuxthub/db/schema` drags `postgres` into the client bundle.
  </div>
</template>

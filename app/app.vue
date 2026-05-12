<template>
  <div style="padding: 2rem; font-family: monospace">
    <h2>Products</h2>
    <ul>
      <li v-for="p in products" :key="p.id" style="margin-bottom: 0.5rem">
        <code style="font-size: 0.75rem; color: #888">{{ p.id }}</code>
        <span style="margin-left: 0.5rem">{{ p.title }}</span>
        <button style="margin-left: 0.5rem" @click="startEdit(p)">edit</button>
      </li>
    </ul>

    <form style="margin-top: 1rem; display: flex; gap: 0.5rem" @submit.prevent="submit">
      <input v-model="inputTitle" placeholder="Product title" />
      <button type="submit">{{ editing ? 'Update' : 'Add' }}</button>
      <button v-if="editing" type="button" @click="cancelEdit">Cancel</button>
    </form>
    <p v-if="validationError" style="color: red; margin-top: 0.5rem">{{ validationError }}</p>
  </div>
</template>

<script setup lang="ts">
const { data: products, refresh } = await useFetch<{ id: string; title: string }[]>('/api/products')

const inputTitle = ref('')
const editing = ref<{ id: string } | null>(null)
const validationError = ref<string | null>(null)

function startEdit(p: { id: string; title: string }) {
  editing.value = { id: p.id }
  inputTitle.value = p.title
  validationError.value = null
}

function cancelEdit() {
  editing.value = null
  inputTitle.value = ''
  validationError.value = null
}

async function submit() {
  validationError.value = null

  if (editing.value) {
    const result = dbSchemaUpdateProduct.safeParse({ title: inputTitle.value })
    if (!result.success) {
      validationError.value = result.error.issues[0]?.message ?? 'Invalid input'
      return
    }
    await $fetch(`/api/products/${editing.value.id}`, { method: 'PATCH', body: result.data })
    cancelEdit()
  }
  else {
    const result = dbSchemaInsertProduct.safeParse({ title: inputTitle.value })
    if (!result.success) {
      validationError.value = result.error.issues[0]?.message ?? 'Invalid input'
      return
    }
    await $fetch('/api/products', { method: 'POST', body: result.data })
    inputTitle.value = ''
  }
  await refresh()
}
</script>

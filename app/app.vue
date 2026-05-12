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
      <input v-model="inputTitle" placeholder="Product title" required />
      <button type="submit">{{ editing ? 'Update' : 'Add' }}</button>
      <button v-if="editing" type="button" @click="cancelEdit">Cancel</button>
    </form>
  </div>
</template>

<script setup lang="ts">
const { data: products, refresh } = await useFetch<{ id: string; title: string }[]>('/api/products')

const inputTitle = ref('')
const editing = ref<{ id: string } | null>(null)

function startEdit(p: { id: string; title: string }) {
  editing.value = { id: p.id }
  inputTitle.value = p.title
}

function cancelEdit() {
  editing.value = null
  inputTitle.value = ''
}

async function submit() {
  if (editing.value) {
    await $fetch(`/api/products/${editing.value.id}`, { method: 'PATCH', body: { title: inputTitle.value } })
    cancelEdit()
  }
  else {
    await $fetch('/api/products', { method: 'POST', body: { title: inputTitle.value } })
    inputTitle.value = ''
  }
  await refresh()
}
</script>

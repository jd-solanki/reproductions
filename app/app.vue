<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as z from 'zod';

const { data: products, refresh } = await useFetch<{ id: string; title: string }[]>('/api/products')

const schema = dbSchemaInsertProduct.pick({ title: true })
type FormData = z.infer<typeof schema>

const state = reactive<FormData>({ title: '' })

async function onSubmit(event: FormSubmitEvent<FormData>) {
  await $fetch('/api/products', { method: 'POST', body: event.data })
  state.title = ''
  await refresh()
}
</script>


<template>
  <div style="padding: 2rem; font-family: monospace">
    <h2>Products</h2>
    <ul>
      <li v-for="p in products" :key="p.id" style="margin-bottom: 0.5rem">
        <code style="font-size: 0.75rem; color: #888">{{ p.id }}</code>
        <span style="margin-left: 0.5rem">{{ p.title }}</span>
      </li>
    </ul>

    <UForm
      :schema="schema"
      :state="state"
      style="margin-top: 1rem; display: flex; gap: 0.5rem; align-items: flex-start"
      @submit="onSubmit"
    >
      <UFormField name="title">
        <UInput v-model="state.title" placeholder="Product title" />
      </UFormField>
      <UButton type="submit">Add</UButton>
    </UForm>
  </div>
</template>
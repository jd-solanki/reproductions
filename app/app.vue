<script lang="ts" setup>
const onClick = async () => {
  console.log('Button clicked')
  const data = await $fetch('/api/webhooks/play', {
    method: 'POST',
    body: { message: 'Hello, World!' }
  })
}
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <button @click="onClick">Trigger</button>
  </div>
</template>

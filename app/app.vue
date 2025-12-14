<script lang="ts" setup>
const onChange = () => {
  updateAppConfig({
    ui: {
      button: {
        variants: {
          size: {
            md: 'py-2 px-4'
          }
        }
      }
    }
  })
}
</script>


<template>
  <div>
    <NuxtRouteAnnouncer />
    <UButton>Button</UButton>
    <UButton @click="onChange">Change</UButton>
  </div>
</template>

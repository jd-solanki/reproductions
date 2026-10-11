<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <EHtml>
    <EBody>
      <EText>Hello   {{ name }}</EText>
      <EButton href="https://nuxt.com">Open Nuxt</EButton>
    </EBody>
  </EHtml>
</template>

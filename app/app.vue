<script setup lang="ts">
const markdown = `
| Name | Role |
| ---- | ---- |
| Ada  | Admin |
`
</script>

<template>
  <UApp>
    <MDC :value="markdown" />
  </UApp>
</template>

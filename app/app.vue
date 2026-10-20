<script setup lang="ts">
const config = useRuntimeConfig()
const apiBase = config.public.apiBase.toUpperCase()
</script>

<template>
  <div>{{ apiBase }}</div>
</template>

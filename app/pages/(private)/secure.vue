<script lang="ts" setup>
definePageMeta({
  hello: true,
})

const route = useRoute()
</script>

<template>
  <pre>{{ route.meta }}</pre>
</template>
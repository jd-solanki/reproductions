<script setup lang="ts">
const markdown = `# Hello

\`\`\`ts
const answer = 42
\`\`\`
`
</script>

<template>
  <MDC :value="markdown" />
</template>

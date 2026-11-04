# Repro: `UContentSearchButton` renders a `<div>` inside its `<button>`

The app renders one `<UContentSearchButton />` and prerenders it. The button wraps its keyboard
hints in `<div data-slot="trailing">`, but `<button>` only permits phrasing content, so
[html-validate](https://html-validate.org/rules/element-permitted-content.html) reports invalid
HTML. `@nuxtjs/html-validator` runs with only `element-permitted-content` enabled and
`failOnError: true`, so this one error fails `nuxt generate`.

|                         |                     |
| ----------------------- | ------------------- |
| `@nuxt/ui`              | 4.12.0              |
| `nuxt`                  | 4.6.4               |
| `@nuxtjs/html-validator`| 2.1.0               |
| `node` / `pnpm`         | 24.20.0 / 9.15.4    |

The `v5` branch has the same wrapper, as `<div data-slot="content-search-button-trailing">` in
`src/runtime/components/content/ContentSearchButton.vue`.

## Run it

```bash
pnpm install
pnpm generate
```

## Expected

`nuxt generate` succeeds: the button holds only phrasing content.

## Actual

```
 ERROR  HTML validation errors found for /

inline
  97:5309  error  <div> element is not permitted as content under <button>  element-permitted-content

✖ 1 problem (1 error, 0 warnings)

 ERROR  html-validator found errors
```

## Control

Replace `app/app.vue` with a plain `UButton` that puts the same `UKbd` hints in its `trailing`
slot. `pnpm generate` then succeeds, because `UButton` renders that slot without a `<div>`:

```vue
<template>
  <UApp>
    <UButton label="Search…" icon="i-lucide-search" color="neutral" variant="outline">
      <template #trailing>
        <UKbd value="meta" variant="subtle" />
        <UKbd value="k" variant="subtle" />
      </template>
    </UButton>
  </UApp>
</template>
```

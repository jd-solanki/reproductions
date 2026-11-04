# Repro: Nuxt UI's prose `<th>` renders without a `scope` attribute

The app renders a two-column markdown table through `<MDC>`, so Nuxt UI's `ProseTh` draws the
header cells. `nuxt generate` prerenders `/`, and `@nuxtjs/html-validator`, set to check only
`wcag/h63`, fails the build because neither `<th>` has a `scope`.

| | |
| --- | --- |
| `@nuxt/ui` | 4.12.0 |
| `@nuxtjs/mdc` | 0.23.2 |
| `@nuxtjs/html-validator` | 2.1.0 |
| `nuxt` | 4.6.4 |
| `node` / `pnpm` | 24.20.0 / 9.15.4 |

## Run it

```bash
pnpm install
pnpm generate
```

## Expected

Each header cell of a markdown table renders as `<th scope="col">`, as `UTable` already does
since nuxt/ui#4410, and `pnpm generate` exits 0.

## Actual

`ProseTh` renders `<th class="…">` with no `scope`, and the build exits 1:

```
 ERROR  HTML validation errors found for /

inline
  97:4994  error  <th> element must have a valid scope attribute: row, col, rowgroup or colgroup  wcag/h63
  97:5129  error  <th> element must have a valid scope attribute: row, col, rowgroup or colgroup  wcag/h63

✖ 2 problems (2 errors, 0 warnings)

 ERROR  html-validator found errors
```

## Control

Override `ProseTh` with one that sets the attribute. `pnpm generate` then exits 0:

```vue
<!-- app/components/ProseTh.global.vue -->
<template>
  <th scope="col"><slot /></th>
</template>
```

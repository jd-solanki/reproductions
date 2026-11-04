# Repro: MDC's Shiki highlighter renders a `<style>` inside `<body>`

The page renders one markdown string with `<MDC>`. Because it contains a highlighted code fence,
MDC appends a `<style>` element with the Shiki token CSS to the root of the rendered markdown, so
the prerendered page has `<style>` inside a `<div>` in `<body>`, which HTML does not permit there.
`@nuxtjs/html-validator` runs with `failOnError: true` and only `element-permitted-content`
enabled, so this is the only thing that can fail the build.

| | |
| --- | --- |
| `@nuxtjs/mdc` | 0.23.2 |
| `nuxt` | 4.6.3 |
| `@nuxtjs/html-validator` | 2.1.0 |
| `node` / `pnpm` | 24.20.0 / 9.15.4 |

## Run it

```bash
pnpm install
pnpm generate
```

## Expected

`pnpm generate` exits 0. The highlighter's CSS goes into `<head>`, or somewhere `<style>` is
permitted.

## Actual

`pnpm generate` exits 1:

```
 ERROR  HTML validation errors found for /

inline
  2:37  error  <style> element is not permitted as content under <div>  element-permitted-content

✖ 1 problem (1 error, 0 warnings)

 ERROR  html-validator found errors
```

The rendered markup: `<div class=""><h1 id="hello">Hello</h1><pre class="language-ts shiki shiki-themes github-light">…</pre><style>html .default .shiki span{…}</style></div>`

The `<style>` node comes from `src/runtime/highlighter/rehype.ts`, which pushes it onto
`tree.children` after highlighting.

## Control

Replace the fenced code block in `app/app.vue` with a plain paragraph. No `<style>` is
rendered and `pnpm generate` exits 0.

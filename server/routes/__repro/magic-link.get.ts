// The repro's mail inbox. `sendMagicLink` in ../../auth.config.ts parks the
// most recent link here instead of mailing it.
//
// It doubles as the liveness control for the rate-limiting steps: those break
// every route under /api/auth, so proving the server is up needs a route that
// better-auth does not own.
export default defineEventHandler(() => ({
  url: globalThis.__reproMagicLink ?? null,
}))

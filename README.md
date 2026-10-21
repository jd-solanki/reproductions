# Repro: `cloudflare-email-service` sends a nameless address as an object, which the binding rejects

A Worker sends one email through unemail's `cloudflare-email-service` driver with plain string
addresses. The driver hands the `send_email` binding `{ email }` with no `name`, and Cloudflare's
runtime rejects it.

|                     |           |
| ------------------- | --------- |
| `unemail`           | 0.7.0     |
| `wrangler`          | 4.151.3   |
| `node` / `pnpm`     | 24.20.0 / 9.15.4 |

## Run it

The binding is `remote: true`: local mode stubs `send_email` without validating addresses, so only
Cloudflare's runtime shows the error. Any Cloudflare account works. No email is sent: `acme.com` is
on nobody's account, so a message the binding accepts stops at the sender check.

```bash
pnpm install
pnpm wrangler login
pnpm repro
```

## Expected

The binding accepts the message, and the send fails only at the sender check:

```
unemail error: [unemail] [cloudflare-email-service] email from acme.com not allowed because domain was not found
```

## Actual

```
unemail error: [unemail] [cloudflare-email-service] Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.
 ELIFECYCLE  Command failed with exit code 1.
```

## Control

Give both addresses a display name in `src/index.js`, `from: 'Acme <hi@acme.com>'` and
`to: 'Ada <ada@example.com>'`, and `pnpm repro` prints the Expected output.

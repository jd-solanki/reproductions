import { createEmail } from 'unemail'
import cloudflareEmailService from 'unemail/drivers/cloudflare-email-service'

export default {
  async fetch(_request, env) {
    const email = createEmail({ driver: cloudflareEmailService({ binding: env.EMAIL }) })

    const { error } = await email.send({
      from: 'hi@acme.com',
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Hello',
    })

    return Response.json({ error: error?.message ?? null })
  },
}

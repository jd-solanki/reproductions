import { createAuthEndpoint } from 'better-auth/api'

// A plain Better Auth plugin. It contributes one user column and one endpoint.
export const demoPlugin = () =>
  ({
    id: 'demo-plugin',
    schema: {
      user: {
        fields: {
          viaPluginField: { type: 'string', required: false },
        },
      },
    },
    endpoints: {
      demoPing: createAuthEndpoint('/demo-ping', { method: 'GET' }, async () => ({ ok: true })),
    },
  }) as const

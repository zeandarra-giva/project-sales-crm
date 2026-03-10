import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'

export const config = {
  name: 'AuthMe',
  description: 'Return the authenticated user profile',
  triggers: [{ type: 'http' as const, path: '/api/auth/me', method: 'GET' as const }],
  enqueues: [],
  flows: ['auth'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }
  logger.info('Me fetched', { userId: user!.id })
  return { status: 200, body: { user } }
}

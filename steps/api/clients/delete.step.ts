import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'DeleteClient',
  description: 'Delete a client',
  triggers: [{ type: 'http' as const, path: '/api/clients/:id', method: 'DELETE' as const }],
  enqueues: [],
  flows: ['clients'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams as { id: string }
  await prisma.client.delete({ where: { id } })
  logger.info('Client deleted', { clientId: id })
  return { status: 200, body: { success: true } }
}
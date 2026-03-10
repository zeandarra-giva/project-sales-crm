import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetClient',
  description: 'Get a single client by ID with contacts and deals',
  triggers: [{ type: 'http' as const, path: '/api/clients/:id', method: 'GET' as const }],
  enqueues: [],
  flows: ['clients'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      industry: true,
      contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
      deals:    { select: { id: true, dealName: true, isClosed: true, stage: { select: { name: true } } } },
    },
  })

  if (!client) return { status: 404, body: { error: 'Client not found' } }
  logger.info('Client fetched', { clientId: id })
  return { status: 200, body: { client } }
}

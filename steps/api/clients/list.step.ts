import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetClients',
  description: 'List all clients with optional filters',
  triggers: [{ type: 'http' as const, path: '/api/clients', method: 'GET' as const }],
  enqueues: [],
  flows: ['clients'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const clients = await prisma.client.findMany({
    where: {
      accountType: q.account_type as never || undefined,
      status:      q.status as never || undefined,
      industryId:  q.industry_id || undefined,
    },
    include: {
      industry: { select: { id: true, name: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
      _count:   { select: { deals: true, contacts: true } },
    },
    orderBy: { name: 'asc' },
  })

  logger.info('Clients fetched', { count: clients.length })
  return { status: 200, body: { clients } }
}

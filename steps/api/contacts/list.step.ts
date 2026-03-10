import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetContacts',
  description: 'List contacts with optional filters by client or decision rank',
  triggers: [{ type: 'http' as const, path: '/api/contacts', method: 'GET' as const }],
  enqueues: [],
  flows: ['contacts'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const contacts = await prisma.contact.findMany({
    where: {
      clientId:     q.client_id || undefined,
      decisionRank: q.decision_rank as never || undefined,
    },
    include: { client: { select: { id: true, name: true, accountType: true } } },
    orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
  })

  logger.info('Contacts fetched', { count: contacts.length })
  return { status: 200, body: { contacts } }
}

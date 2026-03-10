import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'DeleteDeal',
  description: 'Hard delete a deal and its audit logs',
  triggers: [{ type: 'http' as const, path: '/api/deals/:id', method: 'DELETE' as const }],
  enqueues: [],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams as { id: string }

  // Delete audit logs first (FK constraint)
  await prisma.dealAuditLog.deleteMany({ where: { dealId: id } })
  await prisma.deal.delete({ where: { id } })

  logger.info('Deal deleted', { dealId: id })
  return { status: 200, body: { success: true } }
}
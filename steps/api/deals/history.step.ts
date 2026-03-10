import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetDealHistory',
  description: 'GET /api/deals/:id/history — returns stage audit log for a deal',
  triggers: [
    { type: 'http' as const, path: '/api/deals/:id/history', method: 'GET' as const },
  ],
  enqueues: [],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams

  const deal = await prisma.deal.findUnique({ where: { id }, select: { id: true } })
  if (!deal) return { status: 404, body: { error: 'Deal not found' } }

  const history = await prisma.dealAuditLog.findMany({
    where: { dealId: id },
    include: {
      stage: { select: { name: true } },
      changedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { enteredAt: 'asc' },
  })

  const mapped = history.map(h => ({
    id: h.id,
    stage_name: h.stage.name,
    entered_at: h.enteredAt,
    exited_at: h.exitedAt,
    days_in_stage: h.daysInStage,
    notes: h.notes,
    changed_by: `${h.changedBy.firstName} ${h.changedBy.lastName}`,
  }))

  logger.info('GetDealHistory', { dealId: id, count: mapped.length })
  return { status: 200, body: { history: mapped } }
}
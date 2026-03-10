import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { requireManager } from '../../../lib/auth.js'
import { getDaysSince } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetDeal',
  description: 'Get a single deal by ID with full stage history',
  triggers: [{ type: 'http' as const, path: '/api/deals/:id', method: 'GET' as const }],
  enqueues: [],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage:      true,
      bd:         { select: { id: true, firstName: true, lastName: true, email: true } },
      client:     { select: { id: true, name: true, brand: true, accountType: true, industryId: true } },
      service:    true,
      bundle:     { include: { bundleServices: { include: { service: true } } } },
      projection: true,
      auditLogs:  { include: { stage: true }, orderBy: { enteredAt: 'asc' } },
      dealContacts: { include: { contact: true } },
      payments:   { orderBy: { id: 'asc' } },
    },
  })

  if (!deal) return { status: 404, body: { error: 'Deal not found' } }
  if (!requireManager(user!.role) && deal.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const currentLog    = deal.auditLogs.find(l => l.exitedAt === null)
  const daysInStage   = currentLog ? getDaysSince(currentLog.enteredAt) : 0
  const stuckDuration = deal.stage.duration
  const isStuck       = stuckDuration !== null && daysInStage > stuckDuration

  logger.info('Deal fetched', { dealId: id })
  return { status: 200, body: { deal: { ...deal, daysInCurrentStage: daysInStage, isStuck } } }
}

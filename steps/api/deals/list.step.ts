import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getDaysSince } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetDeals',
  description: 'List deals — BD members see own deals, Manager sees all',
  triggers: [{ type: 'http' as const, path: '/api/deals', method: 'GET' as const }],
  enqueues: [],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q        = req.queryParams as Record<string, string>
  const isClosed = q.is_closed !== undefined ? q.is_closed === 'true' : undefined

  const where: Record<string, unknown> = {}
  if (!requireManager(user!.role)) where.bdId = user!.id
  else if (q.bd_id) where.bdId = q.bd_id

  if (q.stage_id)     where.stageId    = q.stage_id
  if (isClosed !== undefined) where.isClosed = isClosed
  if (q.lead_source)  where.leadSource  = q.lead_source
  if (q.client_id)    where.clientId    = q.client_id

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage:      { select: { id: true, name: true, duration: true } },
      bd:         { select: { id: true, firstName: true, lastName: true } },
      client:     { select: { id: true, name: true, brand: true, accountType: true } },
      service:    { select: { id: true, name: true } },
      bundle:     { select: { id: true, name: true } },
      projection: true,
      auditLogs:  { where: { exitedAt: null }, orderBy: { enteredAt: 'desc' }, take: 1 },
    },
    orderBy: { id: 'desc' },
  })

  const enriched = deals.map(deal => {
    const log        = deal.auditLogs[0]
    const days       = log ? getDaysSince(log.enteredAt) : 0
    const maxDays    = deal.stage.duration
    return { ...deal, daysInCurrentStage: days, isStuck: maxDays !== null && days > maxDays }
  })

  logger.info('Deals fetched', { count: enriched.length })
  return { status: 200, body: { deals: enriched } }
}

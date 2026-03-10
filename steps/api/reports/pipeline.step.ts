import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { requireManager } from '../../../lib/auth.js'

export const config = {
  name: 'GetPipelineReport',
  description: 'Pipeline report — deal count and total value per stage',
  triggers: [{ type: 'http' as const, path: '/api/reports/pipeline', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const dealWhere: Record<string, unknown> = {}
  if (!requireManager(user!.role)) dealWhere.bdId = user!.id
  else if (q.bd_id) dealWhere.bdId = q.bd_id
  if (q.service_id) dealWhere.serviceId = q.service_id

  const allStages = await prisma.pipelineStage.findMany()

  const byStage = await prisma.deal.groupBy({
    by:    ['stageId'],
    where: { ...dealWhere, isClosed: false },
    _count: { id: true },
    _sum:   { revenue: true },
  })

  // Weighted value — resolve via deal ids (no relation filters in groupBy)
  const openIds = await prisma.deal.findMany({
    where:  { ...dealWhere, isClosed: false },
    select: { id: true },
  })
  const weightedAgg = await prisma.dealProjection.aggregate({
    where: { dealId: { in: openIds.map(d => d.id) } },
    _sum:  { weightedValue: true },
  })

  const lostStage = allStages.find(s => s.name === 'Closed Lost')
  const lostDeals = lostStage ? await prisma.deal.findMany({
    where:  { ...dealWhere, stageId: lostStage.id },
    select: { finalProposedValue: true },
  }) : []

  logger.info('Pipeline report generated')
  return {
    status: 200,
    body: {
      byStage: byStage.map(row => ({
        ...row,
        stageName: allStages.find(s => s.id === row.stageId)?.name ?? row.stageId,
      })),
      totalWeightedValue: Number(weightedAgg._sum.weightedValue ?? 0),
      lostDealValue:      lostDeals.reduce((s, d) => s + Number(d.finalProposedValue ?? 0), 0),
    },
  }
}

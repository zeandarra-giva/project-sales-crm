import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { STAGE } from '../../../lib/pipeline.js'
import { requireManager } from '../../../lib/auth.js'

export const config = {
  name: 'GetSalesCycleReport',
  description: 'Sales cycle analysis — avg days per stage, bottlenecks, comparison by BD member',
  triggers: [{ type: 'http' as const, path: '/api/reports/sales-cycle', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  let bdIdFilter: string | undefined
  if (!requireManager(user!.role)) bdIdFilter = user!.id
  else if (q.bd_id) bdIdFilter = q.bd_id

  // Resolve deal ids for BD filter — avoids relation filter in groupBy
  let auditDealIds: string[] | undefined
  if (bdIdFilter) {
    const deals   = await prisma.deal.findMany({ where: { bdId: bdIdFilter }, select: { id: true } })
    auditDealIds  = deals.map(d => d.id)
  }

  const [wonStage, closedLostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } }),
  ])

  const closedStageIds = [wonStage?.id, closedLostStage?.id].filter(Boolean) as string[]

  // Avg days per stage
  const stageAvgs = await prisma.dealAuditLog.groupBy({
    by:    ['stageId'],
    where: {
      daysInStage: { not: null },
      stageId:     { notIn: closedStageIds },
      ...(auditDealIds ? { dealId: { in: auditDealIds } } : {}),
    },
    _avg:   { daysInStage: true },
    _count: { id: true },
  })

  const allStages = await prisma.pipelineStage.findMany()

  const dealWhere = {
    ...(bdIdFilter ? { bdId: bdIdFilter } : {}),
    isClosed:      true,
    salesCycleDays: { not: null as null },
  }

  const cycleByOutcome = await prisma.deal.groupBy({
    by:    ['stageId'],
    where: dealWhere,
    _avg:  { salesCycleDays: true },
    _min:  { salesCycleDays: true },
    _max:  { salesCycleDays: true },
    _count: { id: true },
  })

  const fastestDeals = wonStage ? await prisma.deal.findMany({
    where:   { ...(bdIdFilter ? { bdId: bdIdFilter } : {}), stageId: wonStage.id, salesCycleDays: { not: null } },
    orderBy: { salesCycleDays: 'asc' },
    take:    3,
    include: {
      client:  { select: { name: true } },
      service: { select: { name: true } },
      bd:      { select: { firstName: true, lastName: true } },
    },
  }) : []

  const bdCycles = requireManager(user!.role) && wonStage
    ? await prisma.deal.groupBy({
        by:    ['bdId'],
        where: { stageId: wonStage.id, salesCycleDays: { not: null } },
        _avg:  { salesCycleDays: true },
        _count: { id: true },
      })
    : []

  const proposalRevisions = await prisma.deal.aggregate({
    where: { ...(bdIdFilter ? { bdId: bdIdFilter } : {}), isClosed: true },
    _avg:  { proposalRevisionCount: true },
    _max:  { proposalRevisionCount: true },
  })

  logger.info('GetSalesCycleReport computed')
  return {
    status: 200,
    body: {
      avgDaysPerStage: stageAvgs.map(s => ({
        stageName:   allStages.find(st => st.id === s.stageId)?.name ?? s.stageId,
        avgDays:     s._avg.daysInStage ? +Number(s._avg.daysInStage).toFixed(1) : null,
        sampleCount: s._count.id,
      })),
      cycleByOutcome: cycleByOutcome.map(c => ({
        ...c,
        stageName: allStages.find(s => s.id === c.stageId)?.name ?? c.stageId,
      })),
      fastestDeals,
      bdComparison: bdCycles,
      proposalStats: {
        avgRevisions: proposalRevisions._avg.proposalRevisionCount
          ? +Number(proposalRevisions._avg.proposalRevisionCount).toFixed(1) : null,
        maxRevisions: proposalRevisions._max.proposalRevisionCount,
      },
    },
  }
}

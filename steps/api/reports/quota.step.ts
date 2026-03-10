import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getQuarterRange, STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetQuotaReport',
  description: 'Quota vs actual per BD member for a given quarter',
  triggers: [{ type: 'http' as const, path: '/api/reports/quota', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q       = req.queryParams as Record<string, string>
  const now     = new Date()
  const year    = parseInt(q.year    ?? String(now.getFullYear()))
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1))
  const { start, end } = getQuarterRange(year, quarter)

  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } })

  const bdFilter = !requireManager(user!.role) ? { id: user!.id } : {}
  const bds      = await prisma.bD.findMany({
    where:  { ...bdFilter, role: 'BD_REP', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  })

  // Targets via DateDimension — find dates where year+quarter match
  const quarterDates = await prisma.dateDimension.findMany({
    where: { year, quarter },
    select: { id: true },
  })
  const dateIds = quarterDates.map(d => d.id)

  const rows = await Promise.all(bds.map(async bd => {
    const quota = await prisma.target.findFirst({
      where: { bdId: bd.id, periodType: 'QUARTERLY', dateId: { in: dateIds } },
    })
    const actual = wonStage ? await prisma.deal.aggregate({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _sum:  { revenue: true },
    }) : { _sum: { revenue: null } }

    const won = wonStage ? await prisma.deal.count({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    }) : 0

    const quotaVal  = Number(quota?.quota ?? 0)
    const actualVal = Number(actual._sum.revenue ?? 0)
    return {
      bd:            { id: bd.id, firstName: bd.firstName, lastName: bd.lastName },
      quota:         quotaVal,
      actual:        actualVal,
      variance:      quotaVal - actualVal,
      attainmentPct: quotaVal > 0 ? Math.round((actualVal / quotaVal) * 100) : 0,
      dealsWon:      won,
    }
  }))

  logger.info('Quota report generated', { year, quarter })
  return { status: 200, body: { year, quarter, rows } }
}

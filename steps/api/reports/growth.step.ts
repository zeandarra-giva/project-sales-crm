import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getQuarterRange, STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetGrowthReport',
  description: 'Revenue trend by month or quarter with MoM/QoQ deltas',
  triggers: [{ type: 'http' as const, path: '/api/reports/growth', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q       = req.queryParams as Record<string, string>
  const unit    = (q.unit ?? 'quarter') as 'month' | 'quarter'
  const periods = parseInt(q.periods ?? '6')
  const now     = new Date()

  const bdWhere = !requireManager(user!.role) ? { bdId: user!.id } : {}
  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } })

  const trend: { period: string; revenue: number; deals: number; newPipeline: number }[] = []

  for (let i = periods - 1; i >= 0; i--) {
    let start: Date, end: Date, label: string

    if (unit === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      start   = new Date(d.getFullYear(), d.getMonth(), 1)
      end     = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      label   = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short' })
    } else {
      const curQ = Math.floor(now.getMonth() / 3) + 1
      let tQ = curQ - i; let tY = now.getFullYear()
      while (tQ <= 0) { tQ += 4; tY-- }
      const r = getQuarterRange(tY, tQ)
      start = r.start; end = r.end; label = `Q${tQ} ${tY}`
    }

    const [won, created] = await Promise.all([
      wonStage ? prisma.deal.aggregate({
        where: { ...bdWhere, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
        _sum: { revenue: true }, _count: { id: true },
      }) : Promise.resolve({ _sum: { revenue: null }, _count: { id: 0 } }),
      prisma.deal.aggregate({
        where: { ...bdWhere, startDate: { gte: start, lte: end } },
        _sum: { revenue: true }, _count: { id: true },
      }),
    ])

    trend.push({
      period:      label,
      revenue:     Number(won._sum.revenue ?? 0),
      deals:       won._count.id,
      newPipeline: Number(created._sum.revenue ?? 0),
    })
  }

  const withDelta = trend.map((t, i) => {
    if (i === 0) return { ...t, deltaPct: null }
    const prev     = trend[i - 1].revenue
    const deltaPct = prev > 0 ? +(((t.revenue - prev) / prev) * 100).toFixed(1) : null
    return { ...t, deltaPct }
  })

  logger.info('GetGrowthReport computed', { unit, periods })
  return { status: 200, body: { unit, periods, trend: withDelta } }
}

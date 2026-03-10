import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getQuarterRange, getDaysSince, STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetExecutiveDashboard',
  description: 'Manager-only executive dashboard — team quota, leaderboard, pipeline, stuck deals',
  triggers: [{ type: 'http' as const, path: '/api/dashboard/executive', method: 'GET' as const }],
  enqueues: [],
  flows: ['dashboard'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }
  if (!requireManager(user!.role)) {
    return { status: 403, body: { error: 'Executive dashboard is restricted to Sales Managers' } }
  }

  const q       = req.queryParams as Record<string, string>
  const now     = new Date()
  const year    = parseInt(q.year    ?? String(now.getFullYear()))
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1))
  const { start: qStart, end: qEnd } = getQuarterRange(year, quarter)

  const [closedWonStage, negotiationStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.NEGOTIATION } }),
  ])

  // All BD reps (not managers)
  const bdMembers = await prisma.bD.findMany({
    where:  { role: 'BD_REP', isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  })

  const closedDeals = closedWonStage ? await prisma.deal.findMany({
    where:  { stageId: closedWonStage.id, closedDate: { gte: qStart, lte: qEnd } },
    select: { bdId: true, revenue: true, client: { select: { accountType: true } }, service: { select: { name: true } } },
  }) : []

  // Targets for this quarter
  const allTargets = await prisma.target.findMany({
    where:   { periodType: 'QUARTERLY', date: { year, quarter } },
    include: { date: true },
  })

  const allClosed = await prisma.deal.findMany({
    where:  { isClosed: true },
    select: { bdId: true, stageId: true },
  })

  const leaderboard = bdMembers.map(bd => {
    const won      = closedDeals.filter(d => d.bdId === bd.id)
    const revenue  = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
    const quota    = Number(allTargets.find(t => t.bdId === bd.id)?.quota ?? 0)
    const myAll    = allClosed.filter(d => d.bdId === bd.id)
    const wonCount = closedWonStage ? myAll.filter(d => d.stageId === closedWonStage.id).length : 0
    const winRate  = myAll.length > 0 ? Math.round((wonCount / myAll.length) * 100) : 0
    return {
      bd, revenue, quota,
      attainmentPct: quota > 0 ? Math.round((revenue / quota) * 100) : 0,
      dealsWon:      won.length,
      winRate,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  const teamRevenue = leaderboard.reduce((s, l) => s + l.revenue, 0)
  const teamQuota   = leaderboard.reduce((s, l) => s + l.quota,   0)

  const allStages = await prisma.pipelineStage.findMany()
  const pipelineByStage = await prisma.deal.groupBy({
    by:    ['stageId'],
    where: { isClosed: false },
    _count: { id: true },
    _sum:   { revenue: true },
  })

  const pipelineWithNames = pipelineByStage.map(row => ({
    ...row,
    stageName: allStages.find(s => s.id === row.stageId)?.name ?? row.stageId,
  }))

  const negotiationVal = negotiationStage ? await prisma.deal.aggregate({
    where: { stageId: negotiationStage.id, isClosed: false },
    _sum:  { revenue: true },
  }) : { _sum: { revenue: null } }

  const weightedForecast = await prisma.dealProjection.aggregate({
    where: { deal: { isClosed: false } },
    _sum:  { weightedValue: true },
  })

  // Stuck deals across all BDs
  const activeDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    include: {
      stage:    true,
      bd:       { select: { firstName: true, lastName: true } },
      client:   { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, take: 1 },
    },
  })

  const stuckDeals = activeDeals
    .map(d => {
      const log  = d.auditLogs[0]
      const days = log ? getDaysSince(log.enteredAt) : 0
      const max  = d.stage.duration
      return { ...d, daysInStage: days, isStuck: max !== null && days > max }
    })
    .filter(d => d.isStuck)

  const byAccountType = (['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT'] as const).map(type => ({
    accountType: type,
    count:       closedDeals.filter(d => d.client.accountType === type).length,
    revenue:     closedDeals.filter(d => d.client.accountType === type).reduce((s, d) => s + Number(d.revenue ?? 0), 0),
  }))

  const serviceMap: Record<string, { count: number; revenue: number }> = {}
  for (const d of closedDeals) {
    const svc = d.service?.name ?? 'Bundle'
    if (!serviceMap[svc]) serviceMap[svc] = { count: 0, revenue: 0 }
    serviceMap[svc].count++
    serviceMap[svc].revenue += Number(d.revenue ?? 0)
  }

  logger.info('Executive dashboard computed', { year, quarter })
  return {
    status: 200,
    body: {
      period: { year, quarter, start: qStart, end: qEnd },
      team: {
        totalRevenue:     teamRevenue,
        totalQuota:       teamQuota,
        attainmentPct:    teamQuota > 0 ? Math.round((teamRevenue / teamQuota) * 100) : 0,
        salesForecast:    teamRevenue + Number(negotiationVal._sum.revenue ?? 0),
        weightedForecast: Number(weightedForecast._sum.weightedValue ?? 0),
      },
      leaderboard,
      pipelineByStage: pipelineWithNames,
      stuckDeals,
      byAccountType,
      byService: Object.entries(serviceMap).map(([service, data]) => ({ service, ...data })),
    },
  }
}

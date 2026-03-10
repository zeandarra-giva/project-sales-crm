import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getQuarterRange, getCurrentMonth, getDaysSince, STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetBDDashboard',
  description: 'Individual BD dashboard — quota attainment, pipeline metrics, stuck deals',
  triggers: [{ type: 'http' as const, path: '/api/dashboard/bd', method: 'GET' as const }],
  enqueues: [],
  flows: ['dashboard'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const now = new Date()
  const year = parseInt(q.year ?? String(now.getFullYear()))
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1))
  const bdId = requireManager(user!.role) && q.bd_id ? q.bd_id : user!.id

  const { start: qStart, end: qEnd } = getQuarterRange(year, quarter)
  const { start: mStart, end: mEnd } = getCurrentMonth()

  // Resolve stage ids
  const [closedWonStage, negotiationStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.NEGOTIATION } }),
  ])

  // Targets — Target links to DateDimension, so get targets for this BD
  const targets = await prisma.target.findMany({
    where: { bdId },
    include: { date: true },
  })
  // Pick quarterly target whose date falls in the quarter
  const quarterTarget = targets.find(t =>
    t.periodType === 'QUARTERLY' &&
    t.date && t.date.year === year && t.date.quarter === quarter
  )
  const monthTarget = targets.find(t =>
    t.periodType === 'MONTHLY' &&
    t.date && t.date.year === year && t.date.monthNumber === now.getMonth() + 1
  )

  const closedDeals = closedWonStage ? await prisma.deal.findMany({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: qStart, lte: qEnd } },
    select: { revenue: true, dealName: true, client: { select: { name: true } } },
  }) : []

  const closedThisMonth = closedWonStage ? await prisma.deal.aggregate({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: mStart, lte: mEnd } },
    _sum: { revenue: true },
  }) : { _sum: { revenue: null } }

  const openDealsCount = await prisma.deal.count({
    where: { bdId, isClosed: false },
  })

  const negotiationValue = negotiationStage ? await prisma.deal.aggregate({
    where: { bdId, stageId: negotiationStage.id, isClosed: false },
    _sum: { revenue: true },
  }) : { _sum: { revenue: null } }

  // Active deals for stuck detection
  const activeDeals = await prisma.deal.findMany({
    where: { bdId, isClosed: false },
    include: {
      stage: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, take: 1 },
    },
  })

  const pipelineByStage = await prisma.deal.groupBy({
    by: ['stageId'],
    where: { bdId, isClosed: false },
    _count: { id: true },
    _sum: { revenue: true },
  })

  // Revenue trend (last 6 months) — closed won deals
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const recentWins = closedWonStage ? await prisma.deal.findMany({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: sixMonthsAgo } },
    select: { revenue: true, closedDate: true },
  }) : []

  const actualRevenue = closedDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
  const quota = Number(quarterTarget?.quota ?? 0)
  const monthlyQuota = Number(monthTarget?.quota ?? 0)
  const monthlyActual = Number(closedThisMonth._sum.revenue ?? 0)
  const negotiation = Number(negotiationValue._sum.revenue ?? 0)
  const salesForecast = actualRevenue + negotiation

  // ── Monthly forecast: spread deals across their contract months ──────────
  // Mirrors the Excel tracker: each deal contributes full monthly_subscription
  // per month from start_date to due_date. Stage (80%/60%) is a confidence
  // label only — it does NOT reduce the projected amount.

  const forecastMonths: Array<{ label: string; year: number; monthNum: number }> = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    forecastMonths.push({
      label: d.toLocaleString('en-PH', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      monthNum: d.getMonth(),
    })
  }

  // All open deals split by stage for forecast breakdown
  const pipelineDeals = await prisma.deal.findMany({
    where: { bdId, isClosed: false },
    select: {
      monthlySubscription: true,
      startDate: true,
      dueDate: true,
      stage: { select: { name: true } },
    },
  })

  const negotiationDeals = pipelineDeals.filter(d => d.stage.name === STAGE.NEGOTIATION)
  const otherPipelineDeals = pipelineDeals.filter(d =>
    d.stage.name !== STAGE.NEGOTIATION && d.stage.name !== STAGE.PROPOSAL_SENT
  )

  // All Closed Won deals for actuals
  const allClosedWon = closedWonStage ? await prisma.deal.findMany({
    where: { bdId, stageId: closedWonStage.id },
    select: { monthlySubscription: true, startDate: true, closedDate: true, dueDate: true, duration: true },
  }) : []

  const monthlyForecast = forecastMonths.map(({ label, year, monthNum }) => {
    const monthStart = new Date(year, monthNum, 1)
    const monthEnd = new Date(year, monthNum + 1, 0)

    const inMonth = (start: Date | null, end: Date | null, duration: number) => {
      const s = start ?? now
      const e = end ?? new Date(s.getFullYear(), s.getMonth() + duration, 0)
      return s <= monthEnd && e >= monthStart
    }

    // Actual: closed won deals whose contract covers this month
    const actual = allClosedWon
      .filter(d => inMonth(d.closedDate ?? d.startDate, d.dueDate, d.duration ?? 1))
      .reduce((s, d) => s + Number(d.monthlySubscription ?? 0), 0)

    // Negotiation (80% confidence label)
    const negotiation = negotiationDeals
      .filter(d => inMonth(d.startDate, d.dueDate, 1))
      .reduce((s, d) => s + Number(d.monthlySubscription ?? 0), 0)

    return {
      month: label,
      actual: Math.round(actual),
      negotiation: Math.round(negotiation),
    }
  })
  // ─────────────────────────────────────────────────────────────────────────

  const stuckDeals = activeDeals
    .map(deal => {
      const log = deal.auditLogs[0]
      const days = log ? getDaysSince(log.enteredAt) : 0
      const maxDays = deal.stage.duration
      return { ...deal, daysInStage: days, isStuck: maxDays !== null && days > maxDays }
    })
    .filter(d => d.isStuck)

  logger.info('BD dashboard computed', { bdId, quarter, year })
  return {
    status: 200,
    body: {
      period: { year, quarter, start: qStart, end: qEnd },
      metrics: {
        dealsClosedWon: closedDeals.length,
        openDeals: openDealsCount,
        actualRevenue,
        quota,
        quotaAttainmentPct: quota > 0 ? Math.round((actualRevenue / quota) * 100) : 0,
        salesForecast,
        salesVariance: quota - actualRevenue,
        monthlyQuota,
        monthlyActual,
        monthlyExcessDeficit: monthlyActual - monthlyQuota,
        quarterlyExcessDeficit: actualRevenue - quota,
      },
      pipelineByStage,
      stuckDeals,
      revenueTrend: recentWins,
      monthlyForecast,
    },
  }
}
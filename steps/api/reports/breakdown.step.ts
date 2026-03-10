import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getQuarterRange, STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetBreakdownReport',
  description: 'Full quarterly breakdown — BD, client type, service, lead source, industry, pricing, vendor',
  triggers: [{ type: 'http' as const, path: '/api/reports/breakdown', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }
  if (!requireManager(user!.role)) {
    return { status: 403, body: { error: 'Breakdown report is restricted to Sales Managers' } }
  }

  const q       = req.queryParams as Record<string, string>
  const now     = new Date()
  const year    = parseInt(q.year    ?? String(now.getFullYear()))
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1))
  const { start, end } = getQuarterRange(year, quarter)

  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } })
  if (!wonStage) return { status: 500, body: { error: 'Pipeline stages not seeded yet' } }

  const wonDeals = await prisma.deal.findMany({
    where: { stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    include: {
      bd:      { select: { id: true, firstName: true, lastName: true } },
      client:  { select: { name: true, accountType: true, referralId: true, industry: { select: { name: true } } } },
      service: { select: { id: true, name: true } },
      bundle:  { select: { id: true, name: true } },
    },
  })

  const totalRevenue = wonDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
  const totalDeals   = wonDeals.length

  // BD Breakdown
  const bdMap: Record<string, { bdName: string; revenue: number; count: number }> = {}
  for (const d of wonDeals) {
    if (!bdMap[d.bdId]) bdMap[d.bdId] = { bdName: `${d.bd.firstName} ${d.bd.lastName}`, revenue: 0, count: 0 }
    bdMap[d.bdId].revenue += Number(d.revenue ?? 0)
    bdMap[d.bdId].count++
  }
  const byBd = Object.values(bdMap)
    .map(b => ({ ...b, pct: totalRevenue > 0 ? +((b.revenue / totalRevenue) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  // Client type breakdown
  const byAccountType = (['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT'] as const).map(type => {
    const deals   = wonDeals.filter(d => d.client.accountType === type)
    const revenue = deals.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
    return { accountType: type, count: deals.length, revenue, pct: totalRevenue > 0 ? +((revenue / totalRevenue) * 100).toFixed(1) : 0 }
  }).filter(r => r.count > 0)

  // Service breakdown
  const svcMap: Record<string, { name: string; revenue: number; count: number }> = {}
  for (const d of wonDeals) {
    const key   = d.serviceId ?? d.bundleId ?? 'bundle'
    const label = d.service?.name ?? d.bundle?.name ?? 'Bundle'
    if (!svcMap[key]) svcMap[key] = { name: label, revenue: 0, count: 0 }
    svcMap[key].revenue += Number(d.revenue ?? 0)
    svcMap[key].count++
  }
  const byService = Object.values(svcMap)
    .map(s => ({ ...s, pct: totalRevenue > 0 ? +((s.revenue / totalRevenue) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  // Lead source breakdown
  const byLeadSource = (['INBOUND', 'OUTBOUND', 'REFERRAL'] as const).map(src => {
    const deals   = wonDeals.filter(d => d.leadSource === src)
    const revenue = deals.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
    return { leadSource: src, count: deals.length, revenue, pct: totalRevenue > 0 ? +((revenue / totalRevenue) * 100).toFixed(1) : 0 }
  }).filter(r => r.count > 0)

  // Industry breakdown
  const indMap: Record<string, { industry: string; revenue: number; count: number }> = {}
  for (const d of wonDeals) {
    const name = d.client.industry?.name ?? 'Unknown'
    if (!indMap[name]) indMap[name] = { industry: name, revenue: 0, count: 0 }
    indMap[name].revenue += Number(d.revenue ?? 0)
    indMap[name].count++
  }
  const industryBreakdown = Object.values(indMap).sort((a, b) => b.revenue - a.revenue)

  // Avg pricing per service
  const allServices = await prisma.service.findMany({ where: { isActive: true } })
  const avgPricing = await Promise.all(allServices.map(async svc => {
    const agg = await prisma.deal.aggregate({
      where: { serviceId: svc.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _avg:  { monthlySubscription: true },
      _count: { id: true },
    })
    return {
      service:    svc.name,
      avgMonthly: agg._avg.monthlySubscription ? +Number(agg._avg.monthlySubscription).toFixed(2) : null,
      dealCount:  agg._count.id,
    }
  }))

  const overallAvg = await prisma.deal.aggregate({
    where: { stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    _avg:  { monthlySubscription: true },
  })
  const bundleAvg = await prisma.deal.aggregate({
    where: { bundleId: { not: null }, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    _avg:  { monthlySubscription: true },
    _count: { id: true },
  })

  // Vendor (referral) breakdown
  const withReferral    = wonDeals.filter(d => d.client.referralId)
  const withoutReferral = wonDeals.filter(d => !d.client.referralId)
  const refClientIds    = [...new Set(withReferral.map(d => d.client.referralId).filter(Boolean) as string[])]
  const refClients      = refClientIds.length > 0
    ? await prisma.client.findMany({ where: { id: { in: refClientIds } }, select: { id: true, name: true } })
    : []
  const refMap: Record<string, { vendor: string; count: number }> = {}
  for (const d of withReferral) {
    const refId   = d.client.referralId!
    const refName = refClients.find(c => c.id === refId)?.name ?? refId
    if (!refMap[refId]) refMap[refId] = { vendor: refName, count: 0 }
    refMap[refId].count++
  }
  const vendorBreakdown = [
    ...Object.values(refMap).sort((a, b) => b.count - a.count),
    { vendor: 'None', count: withoutReferral.length },
  ].filter(v => v.count > 0)

  // QoQ growth
  const prevQ = quarter === 1 ? 4 : quarter - 1
  const prevY = quarter === 1 ? year - 1 : year
  const { start: prevStart, end: prevEnd } = getQuarterRange(prevY, prevQ)
  const prevRevAgg = await prisma.deal.aggregate({
    where: { stageId: wonStage.id, closedDate: { gte: prevStart, lte: prevEnd } },
    _sum:  { revenue: true },
  })
  const prevTotal = Number(prevRevAgg._sum.revenue ?? 0)

  const quarterlyTrend = await Promise.all(
    Array.from({ length: 4 }, (_, i) => {
      let tQ = quarter - i; let tY = year
      while (tQ <= 0) { tQ += 4; tY-- }
      const { start: tS, end: tE } = getQuarterRange(tY, tQ)
      return prisma.deal.aggregate({
        where: { stageId: wonStage.id, closedDate: { gte: tS, lte: tE } },
        _sum:  { revenue: true },
        _count: { id: true },
      }).then(r => ({ period: `Q${tQ} ${tY}`, revenue: Number(r._sum.revenue ?? 0), deals: r._count.id }))
    })
  ).then(r => r.reverse())

  logger.info('GetBreakdownReport computed', { year, quarter, totalDeals, totalRevenue })
  return {
    status: 200,
    body: {
      period:   { year, quarter, label: `${year} Q${quarter} BREAKDOWN`, start, end },
      summary:  { totalRevenue, totalDeals },
      byBd, byAccountType, byService, byLeadSource, industryBreakdown,
      avgPricing: {
        overall:        overallAvg._avg.monthlySubscription ? +Number(overallAvg._avg.monthlySubscription).toFixed(2) : null,
        bundle:         bundleAvg._avg.monthlySubscription  ? +Number(bundleAvg._avg.monthlySubscription).toFixed(2)  : null,
        bundleDealCount: bundleAvg._count.id,
        byService:      avgPricing,
      },
      vendorBreakdown,
      growth: {
        prevQuarterRevenue: prevTotal,
        currentRevenue:     totalRevenue,
        qoqGrowthPct:       prevTotal > 0 ? +(((totalRevenue - prevTotal) / prevTotal) * 100).toFixed(1) : null,
        quarterlyTrend,
      },
    },
  }
}

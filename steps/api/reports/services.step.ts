import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetServiceReport',
  description: 'Service performance — revenue, deal count, win rate, avg sales cycle per service',
  triggers: [{ type: 'http' as const, path: '/api/reports/services', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const [wonStage, lostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } }),
  ])

  const services = await prisma.service.findMany({ where: { isActive: true } })

  const rows = await Promise.all(services.map(async svc => {
    const deals = await prisma.deal.findMany({
      where:  { serviceId: svc.id },
      select: { stageId: true, revenue: true, isClosed: true, salesCycleDays: true },
    })
    const won    = wonStage  ? deals.filter(d => d.stageId === wonStage.id)  : []
    const lost   = lostStage ? deals.filter(d => d.stageId === lostStage.id) : []
    const closed = [...won, ...lost]
    const revenue  = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
    const winRate  = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
    const avgCycle = closed.length > 0
      ? Math.round(closed.reduce((s, d) => s + (d.salesCycleDays ?? 0), 0) / closed.length) : 0

    return {
      service: svc,
      totalDeals:       deals.length,
      won:              won.length,
      lost:             lost.length,
      active:           deals.filter(d => !d.isClosed).length,
      revenue,
      winRate,
      avgDealSize:      won.length > 0 ? Math.round(revenue / won.length) : 0,
      avgSalesCycleDays: avgCycle,
    }
  }))

  // Avg days per stage from audit logs — scalar groupBy, no relation filter needed
  const stageAvgs = await prisma.dealAuditLog.groupBy({
    by:    ['stageId'],
    where: { daysInStage: { not: null } },
    _avg:  { daysInStage: true },
  })

  const allStages = await prisma.pipelineStage.findMany()
  const stageAvgsNamed = stageAvgs.map(row => ({
    stageName: allStages.find(s => s.id === row.stageId)?.name ?? row.stageId,
    avgDays:   row._avg.daysInStage ? +Number(row._avg.daysInStage).toFixed(1) : null,
  }))

  logger.info('Service report generated')
  return { status: 200, body: { services: rows, avgDaysPerStage: stageAvgsNamed } }
}

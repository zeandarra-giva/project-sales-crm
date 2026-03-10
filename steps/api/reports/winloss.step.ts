import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { STAGE } from '../../../lib/pipeline.js'

export const config = {
  name: 'GetWinLossReport',
  description: 'Win/loss analysis with final proposed values, remarks, and loss notes',
  triggers: [{ type: 'http' as const, path: '/api/reports/win-loss', method: 'GET' as const }],
  enqueues: [],
  flows: ['reports'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const dealWhere: Record<string, unknown> = { isClosed: true }
  if (!requireManager(user!.role)) dealWhere.bdId = user!.id
  if (q.bd_id && requireManager(user!.role)) dealWhere.bdId = q.bd_id
  if (q.service_id) dealWhere.serviceId = q.service_id

  const [wonStage, lostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } }),
  ])

  const closed = await prisma.deal.findMany({
    where: dealWhere,
    include: {
      stage:  true,
      bd:     { select: { firstName: true, lastName: true } },
      client: { select: { name: true, accountType: true } },
      service: { select: { name: true } },
      auditLogs: wonStage && lostStage
        ? { where: { stageId: lostStage.id }, take: 1 }
        : undefined,
    },
    orderBy: { closedDate: 'desc' },
  })

  const won  = wonStage  ? closed.filter(d => d.stageId === wonStage.id)  : []
  const lost = lostStage ? closed.filter(d => d.stageId === lostStage.id) : []

  const totalWonRevenue = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
  const totalLostValue  = lost.reduce((s, d) => s + Number(d.finalProposedValue ?? 0), 0)
  const winRate         = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
  const avgSalesCycle   = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + (d.salesCycleDays ?? 0), 0) / closed.length)
    : 0

  logger.info('Win/loss report generated')
  return {
    status: 200,
    body: {
      summary: {
        totalClosed: closed.length, won: won.length, lost: lost.length,
        winRate, totalWonRevenue, totalLostValue, avgSalesCycleDays: avgSalesCycle,
      },
      wonDeals:  won,
      lostDeals: lost.map(d => ({ ...d, closingNotes: d.auditLogs?.[0]?.notes })),
    },
  }
}

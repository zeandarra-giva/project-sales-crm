import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'

export const config = {
  name: 'WeeklyForecastSnapshot',
  description: 'Cron: weekly point-in-time snapshot per BD and team-level for trend analysis',
  triggers: [cron('0 0 6 * * 1 *')],
  enqueues: [],
  flows: ['reporting'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const openDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    select: {
      id: true, bdId: true, revenue: true, stageId: true,
      remarks: true, actionPlan: true,
      projection: {
        select: { probabilityPct: true, projectedAmount: true, weightedValue: true },
      },
    },
  })

  const bdMembers = await prisma.bD.findMany({
    where: { role: 'BD_REP', isActive: true },
    select: { id: true },
  })

  type ForecastRow = {
    bdId: string | null
    totalPipelineValue: number
    totalWeightedValue: number
    dealCount: number
  }

  const forecastRows: ForecastRow[] = bdMembers.map(bd => {
    const myDeals = openDeals.filter(d => d.bdId === bd.id)
    return {
      bdId: bd.id,
      totalPipelineValue: myDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0),
      totalWeightedValue: myDeals.reduce((s, d) => s + Number(d.projection?.weightedValue ?? 0), 0),
      dealCount: myDeals.length,
    }
  })

  // Team-level (bdId null)
  forecastRows.push({
    bdId: null,
    totalPipelineValue: openDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0),
    totalWeightedValue: openDeals.reduce((s, d) => s + Number(d.projection?.weightedValue ?? 0), 0),
    dealCount: openDeals.length,
  })

  const dealSnapshotData = openDeals.map(deal => ({
    dealId: deal.id,
    stageId: deal.stageId,
    probabilityPct: deal.projection?.probabilityPct ?? null,
    projectedAmount: deal.projection?.projectedAmount ?? null,
    weightedValue: deal.projection?.weightedValue ?? null,
    remarks: deal.remarks ?? null,
    actionPlan: deal.actionPlan ?? null,
  }))

  await prisma.$transaction([
    ...forecastRows.map(row => prisma.forecastSnapshot.create({ data: row })),
    ...dealSnapshotData.map(row => prisma.dealSnapshot.create({ data: row })),
  ])

  logger.info('WeeklyForecastSnapshot completed', {
    forecastSnapshots: forecastRows.length,
    dealSnapshots: dealSnapshotData.length,
  })
}

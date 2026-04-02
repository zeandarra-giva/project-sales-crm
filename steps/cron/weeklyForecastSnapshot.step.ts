import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'

export const config = {
  name: 'Weekly Forecast Snapshot',
  description: 'Sunday midnight: capture ForecastSnapshot for team and per-BD member trend analysis',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 0 * * 7', // Sunday at midnight (7 = Sunday)
    },
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const now = new Date()

  // Find the DateDimension record for the current month (for linking snapshots)
  const dateDim = await prisma.dateDimension.findFirst({
    where: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    },
    select: { id: true },
  })

  // Get all active BD members
  const bdMembers = await prisma.bD.findMany({
    where: { isActive: true, role: 'BD_REP' },
    select: { id: true },
  })

  // Per-BD snapshots
  for (const bd of bdMembers) {
    const openDeals = await prisma.deal.findMany({
      where: { bdId: bd.id, isClosed: false },
      select: { revenue: true },
      // Include projection data for weighted values
    })

    const totalPipelineValue = openDeals.reduce(
      (sum, d) => sum + Number(d.revenue || 0),
      0
    )

    // Get weighted value from negotiation-stage deals (80% weight per dashboard formula)
    const negotiationDeals = await prisma.deal.findMany({
      where: {
        bdId: bd.id,
        isClosed: false,
        stage: { name: 'Negotiation' },
      },
      select: { revenue: true },
    })

    const negotiationValue = negotiationDeals.reduce(
      (sum, d) => sum + Number(d.revenue || 0),
      0
    )

    // Closed Won revenue for the current quarter
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
    const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1)
    const closedWon = await prisma.deal.findMany({
      where: {
        bdId: bd.id,
        isClosed: true,
        closedDate: { gte: quarterStart },
        stage: { name: 'Closed Won' },
      },
      select: { revenue: true },
    })

    const closedRevenue = closedWon.reduce(
      (sum, d) => sum + Number(d.revenue || 0),
      0
    )

    const totalWeightedValue = closedRevenue + negotiationValue * 0.8

    await prisma.forecastSnapshot.create({
      data: {
        bdId: bd.id,
        totalPipelineValue,
        totalWeightedValue,
        dealCount: openDeals.length,
        snapshotDateId: dateDim?.id || undefined,
      },
    })
  }

  // Team-level snapshot (bdId = null)
  const allOpenDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    select: { revenue: true },
  })

  const teamPipelineValue = allOpenDeals.reduce(
    (sum, d) => sum + Number(d.revenue || 0),
    0
  )

  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
  const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1)

  const allClosedWon = await prisma.deal.findMany({
    where: {
      isClosed: true,
      closedDate: { gte: quarterStart },
      stage: { name: 'Closed Won' },
    },
    select: { revenue: true },
  })

  const allNegotiation = await prisma.deal.findMany({
    where: {
      isClosed: false,
      stage: { name: 'Negotiation' },
    },
    select: { revenue: true },
  })

  const teamClosedRevenue = allClosedWon.reduce(
    (sum, d) => sum + Number(d.revenue || 0),
    0
  )
  const teamNegotiationValue = allNegotiation.reduce(
    (sum, d) => sum + Number(d.revenue || 0),
    0
  )

  await prisma.forecastSnapshot.create({
    data: {
      totalPipelineValue: teamPipelineValue,
      totalWeightedValue: teamClosedRevenue + teamNegotiationValue * 0.8,
      dealCount: allOpenDeals.length,
      snapshotDateId: dateDim?.id || undefined,
    },
  })

  logger.info(`Forecast snapshot captured: ${bdMembers.length} BD snapshots + 1 team snapshot`)
}

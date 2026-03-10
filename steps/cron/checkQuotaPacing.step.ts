import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { getCurrentQuarter, getQuarterRange, STAGE } from '../../lib/pipeline.js'
import { createQuotaNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'CheckQuotaPacing',
  description: 'Cron: fires QUOTA_BEHIND_PACE for BD members behind expected quarterly pace',
  triggers: [cron('0 0 9 * * 1 *')],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const { quarter, year, start, end } = getCurrentQuarter()
  const now = new Date()
  const totalDays = (end.getTime() - start.getTime()) / 86400000
  const elapsed = (now.getTime() - start.getTime()) / 86400000
  const expectedPct = Math.min(Math.round((elapsed / totalDays) * 100), 100)

  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } })

  const bdMembers = await prisma.bD.findMany({
    where: { role: 'BD_REP', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  })

  const managers = await prisma.bD.findMany({
    where: { role: 'SALES_MANAGER', isActive: true },
    select: { id: true },
  })

  // Resolve DateDimension ids for this quarter for target lookup
  const quarterDates = await prisma.dateDimension.findMany({
    where: { year, quarter },
    select: { id: true },
  })
  const dateIds = quarterDates.map(d => d.id)

  let fired = 0
  for (const bd of bdMembers) {
    const quota = await prisma.target.findFirst({
      where: { bdId: bd.id, periodType: 'QUARTERLY', dateId: { in: dateIds } },
    })
    if (!quota || Number(quota.quota) === 0) continue

    const actual = wonStage ? await prisma.deal.aggregate({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _sum: { revenue: true },
    }) : { _sum: { revenue: null } }

    const forecast = await prisma.dealProjection.aggregate({
      where: { bdId: bd.id, deal: { isClosed: false } },
      _sum: { weightedValue: true },
    })

    const actualRev = Number(actual._sum.revenue ?? 0)
    const attainmentPct = Math.round((actualRev / Number(quota.quota)) * 100)
    if (attainmentPct >= expectedPct - 15) continue

    const gap = Number(quota.quota) - actualRev
    const forecastedPct = Math.round(
      ((actualRev + Number(forecast._sum.weightedValue ?? 0)) / Number(quota.quota)) * 100
    )
    const content = `📊 ${bd.firstName} ${bd.lastName} is at ${attainmentPct}% quota attainment ` +
      `(expected ${expectedPct}% at this point in Q${quarter}). Gap: ₱${gap.toLocaleString()}. Forecasted: ${forecastedPct}%.`

    await createQuotaNotification({ bdId: bd.id, type: 'QUOTA_BEHIND_PACE', triggeredBy: NotificationTrigger.QUOTA_BEHIND_PACE, content })

    for (const mgr of managers) {
      await createQuotaNotification({ bdId: mgr.id, type: 'QUOTA_BEHIND_PACE', triggeredBy: NotificationTrigger.QUOTA_BEHIND_PACE, content })
    }
    fired++
  }

  logger.info('CheckQuotaPacing completed', { quarter, year, expectedPct, fired })
}

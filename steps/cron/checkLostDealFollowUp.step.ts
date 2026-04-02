import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { createNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Lost Deal Follow Up',
  description: 'Daily 8 AM: create 30-day re-engagement alerts for Closed Lost deals',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 8 * * *',
    },
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startOfDay = new Date(thirtyDaysAgo)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(thirtyDaysAgo)
  endOfDay.setHours(23, 59, 59, 999)

  // Find deals closed as Lost exactly 30 days ago
  const lostDeals = await prisma.deal.findMany({
    where: {
      isClosed: true,
      closedDate: { gte: startOfDay, lte: endOfDay },
      stage: { name: 'Closed Lost' },
    },
    include: {
      client: { select: { name: true } },
    },
  })

  let created = 0
  for (const deal of lostDeals) {
    const notif = await createNotification({
      bdId: deal.bdId,
      dealId: deal.id,
      type: 'LOST_DEAL_FOLLOW_UP',
      triggeredBy: 'CLOSED_LOST_AGE',
      content: `30-day follow-up: Re-engage ${deal.client.name} for new opportunities (Lost deal: "${deal.dealName}")`,
    })
    if (notif) created++
  }

  logger.info(`Lost deal follow-up: checked ${lostDeals.length}, created ${created} notifications`)
}

import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { createNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Follow Up Due',
  description: 'Daily 8 AM: alert when no follow-up has been recorded on a deal in 14+ days',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 8 * * *',
    },
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  // Find open deals where lastFollowUpAt is older than 14 days (or never set)
  const staleDeals = await prisma.deal.findMany({
    where: {
      isClosed: false,
      OR: [
        { lastFollowUpAt: { lt: fourteenDaysAgo } },
        { lastFollowUpAt: null },
      ],
    },
    include: {
      client: { select: { name: true } },
    },
  })

  // For deals with no lastFollowUpAt, use startDate or lastStageUpdateAt as baseline
  let created = 0
  for (const deal of staleDeals) {
    const referenceDate = deal.lastFollowUpAt || deal.lastStageUpdateAt || deal.startDate
    if (!referenceDate) continue // Skip deals with no dates at all

    // Only alert if the reference date is actually > 14 days old
    if (referenceDate >= fourteenDaysAgo) continue

    const daysSince = Math.floor(
      (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const notif = await createNotification({
      bdId: deal.bdId,
      dealId: deal.id,
      type: 'FOLLOW_UP_DUE',
      triggeredBy: 'NO_FOLLOW_UP_IN_14_DAYS',
      content: `No follow-up in ${daysSince} days: "${deal.dealName}" (${deal.client.name})`,
    })
    if (notif) created++
  }

  logger.info(`Follow-up due check: ${staleDeals.length} stale, created ${created} notifications`)
}

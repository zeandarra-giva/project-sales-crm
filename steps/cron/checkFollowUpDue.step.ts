import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

const THRESHOLD_DAYS = 14

export const config = {
  name: 'CheckFollowUpDue',
  description: 'Cron: fires FOLLOW_UP_DUE for open deals with no follow-up in 14+ days',
  triggers: [cron("0 0 8 * * 1-5")],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - THRESHOLD_DAYS)

  const staleDeals = await prisma.deal.findMany({
    where: {
      isClosed: false,
      OR: [
        { lastFollowUpAt: { lte: cutoff } },
        { lastFollowUpAt: null, startDate: { lte: cutoff } },
      ],
    },
    include: { client: { select: { name: true } }, stage: { select: { name: true } } },
  })

  let fired = 0
  for (const deal of staleDeals) {
    const lastActivity = deal.lastFollowUpAt ?? deal.startDate ?? new Date()
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86400000)

    await createNotification({
      bdId: deal.bdId,
      type: 'FOLLOW_UP_DUE',
      triggeredBy: NotificationTrigger.NO_FOLLOW_UP_IN_14_DAYS,
      dealId: deal.id,
      content: `📞 No follow-up on "${deal.dealName}" (${deal.client.name}) in ${daysSince} days. Stage: ${deal.stage.name}.`,
    })
    fired++
  }

  logger.info('CheckFollowUpDue completed', { fired })
}

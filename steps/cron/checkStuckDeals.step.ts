import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { getDaysSince } from '../../lib/pipeline.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'CheckStuckDeals',
  description: 'Cron: fires DEAL_STUCK notification for open deals exceeding their stage duration',
  triggers: [cron('0 0 8 * * * *')],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const activeDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    include: {
      stage: true,
      client: { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, orderBy: { enteredAt: 'desc' }, take: 1 },
    },
  })

  let fired = 0
  for (const deal of activeDeals) {
    const log = deal.auditLogs[0]
    if (!log || deal.stage.duration === null) continue

    const daysInStage = getDaysSince(log.enteredAt)
    if (daysInStage <= deal.stage.duration) continue

    await createNotification({
      bdId: deal.bdId,
      type: 'DEAL_STUCK',
      triggeredBy: NotificationTrigger.DAYS_IN_STAGE_EXCEEDED,
      dealId: deal.id,
      content: `⚠️ "${deal.dealName}" (${deal.client.name}) has been in ${deal.stage.name} for ${daysInStage} days — target is ${deal.stage.duration}d.`,
    })
    fired++
  }

  logger.info('CheckStuckDeals completed', { checked: activeDeals.length, fired })
}

import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'
import { STAGE } from '../../lib/pipeline.js'

export const config = {
  name: 'CheckLostDealFollowUp',
  description: 'Cron: re-engagement reminder 30 days after Closed Lost',
  triggers: [cron('0 0 9 * * 1 *')],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const target = new Date()
  target.setDate(target.getDate() - 30)
  const start = new Date(target); start.setHours(0, 0, 0, 0)
  const end = new Date(target); end.setHours(23, 59, 59, 999)

  const lostStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } })
  if (!lostStage) return

  const lostDeals = await prisma.deal.findMany({
    where: { stageId: lostStage.id, closedDate: { gte: start, lte: end } },
    include: { client: { select: { name: true } } },
  })

  let fired = 0
  for (const deal of lostDeals) {
    await createNotification({
      bdId: deal.bdId,
      type: 'LOST_DEAL_FOLLOW_UP',
      triggeredBy: NotificationTrigger.CLOSED_LOST_AGE,
      dealId: deal.id,
      content: `🔄 It's been 30 days since "${deal.dealName}" (${deal.client.name}) was Closed Lost. Consider re-engagement.`,
    })
    fired++
  }

  logger.info('CheckLostDealFollowUp completed', { fired })
}

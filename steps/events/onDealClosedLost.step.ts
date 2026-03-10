import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnDealClosedLost',
  description: 'Event: schedules a 30-day follow-up reminder when a deal is lost',
  triggers: [{ type: 'queue' as const, topic: 'deal.closed.lost' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name } = event as { deal_id: string; bd_id: string; deal_name: string }

  const deal = await prisma.deal.findUnique({ where: { id: deal_id }, include: { client: { select: { name: true } } } })
  if (!deal) return

  const followUpDate = new Date()
  followUpDate.setDate(followUpDate.getDate() + 30)

  await prisma.notification.create({
    data: {
      bdId: bd_id,
      type: 'LOST_DEAL_FOLLOW_UP',
      triggeredBy: NotificationTrigger.CLOSED_LOST_AGE,
      dealId: deal_id,
      scheduledAt: followUpDate,
      content: `🔄 30-day check-in: Follow up with ${deal.client.name} about "${deal_name}". Consider re-engagement.`,
    },
  })

  logger.info('OnDealClosedLost: follow-up scheduled', { deal_id, followUpDate })
}

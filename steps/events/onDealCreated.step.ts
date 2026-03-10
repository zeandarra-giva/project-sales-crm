import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnDealCreated',
  description: 'Event: notifies BD when a manager creates a deal and assigns it to them',
  triggers: [{ type: 'queue' as const, topic: 'deal.created' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, created_by_id } = event as {
    deal_id: string; bd_id: string; deal_name: string; created_by_id: string
  }

  if (created_by_id === bd_id) return

  const [creator, deal] = await Promise.all([
    prisma.bD.findUnique({ where: { id: created_by_id }, select: { firstName: true, lastName: true } }),
    prisma.deal.findUnique({ where: { id: deal_id }, include: { client: { select: { name: true } }, service: { select: { name: true } } } }),
  ])

  const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Manager'
  const service = deal?.service?.name ?? 'Bundle deal'
  const revenue = deal?.revenue ? `₱${Number(deal.revenue).toLocaleString()}` : 'TBD'

  await createNotification({
    bdId: bd_id,
    type: 'NEW_DEAL_ASSIGNED',
    triggeredBy: NotificationTrigger.STAGE_CHANGE,
    dealId: deal_id,
    content: `📋 ${creatorName} assigned you a new deal: "${deal_name}" (${deal?.client?.name}) — ${service}, ${revenue}.`,
  })

  logger.info('OnDealCreated notification sent', { deal_id, bd_id })
}

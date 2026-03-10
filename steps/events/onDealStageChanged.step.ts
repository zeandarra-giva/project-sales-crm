import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnDealStageChanged',
  description: 'Event: fires STAGE_CHANGE notification when a deal moves to a new stage',
  triggers: [{ type: 'queue' as const, topic: 'deal.stage.changed' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, old_stage, new_stage } = event as {
    deal_id: string; bd_id: string; deal_name: string; old_stage: string; new_stage: string
  }

  const emoji = new_stage === 'Closed Won' ? '🎉' : new_stage === 'Closed Lost' ? '❌' : new_stage === 'Negotiation' ? '🤝' : '🔄'

  await createNotification({
    bdId: bd_id,
    type: 'STAGE_CHANGE',
    triggeredBy: NotificationTrigger.STAGE_CHANGE,
    dealId: deal_id,
    content: `${emoji} "${deal_name}" moved from ${old_stage} → ${new_stage}.`,
  })

  if (new_stage === 'Closed Won' || new_stage === 'Closed Lost') {
    const managers = await prisma.bD.findMany({
      where: { role: 'SALES_MANAGER', isActive: true },
      select: { id: true },
    })
    const deal = await prisma.deal.findUnique({
      where: { id: deal_id },
      include: { client: { select: { name: true } }, bd: { select: { firstName: true, lastName: true } } },
    })
    const bdName = deal?.bd ? `${deal.bd.firstName} ${deal.bd.lastName}` : 'BD'
    const revenue = deal?.revenue ? ` — ₱${Number(deal.revenue).toLocaleString()}` : ''

    for (const mgr of managers) {
      if (mgr.id === bd_id) continue
      await createNotification({
        bdId: mgr.id,
        type: 'STAGE_CHANGE',
        triggeredBy: NotificationTrigger.STAGE_CHANGE,
        dealId: deal_id,
        content: `${emoji} ${bdName}'s deal "${deal_name}" (${deal?.client?.name}) was marked ${new_stage}${revenue}.`,
      })
    }
  }

  logger.info('OnDealStageChanged processed', { deal_id, old_stage, new_stage })
}

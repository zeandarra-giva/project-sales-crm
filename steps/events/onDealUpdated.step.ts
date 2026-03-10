import { type Handlers, type StepConfig } from 'motia'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnDealUpdated',
  description: 'Event: notifies BD when manager adds remarks to their deal',
  triggers: [{ type: 'queue' as const, topic: 'deal.updated' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, fields_changed, manager_notified } = event as {
    deal_id: string; bd_id: string; deal_name: string; fields_changed: string[]; manager_notified?: boolean
  }

  if (manager_notified && fields_changed.includes('remarks')) {
    await createNotification({
      bdId: bd_id,
      type: 'STAGE_CHANGE',
      triggeredBy: NotificationTrigger.STAGE_CHANGE,
      dealId: deal_id,
      content: `📝 Manager added remarks to your deal "${deal_name}". Check for updated guidance.`,
    })
  }

  logger.info('OnDealUpdated processed', { deal_id, fields_changed })
}

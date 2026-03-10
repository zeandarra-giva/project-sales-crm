import { type Handlers, type StepConfig } from 'motia'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnLeadAssigned',
  description: 'Event: notifies BD when a lead is assigned',
  triggers: [{ type: 'queue' as const, topic: 'lead.assigned' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { bd_id, deal_id, deal_name, client_name, lead_source } = event as {
    bd_id: string; deal_id: string; deal_name: string; client_name: string; lead_source: string
  }
  const emoji: Record<string, string> = { INBOUND: '📥', OUTBOUND: '📤', REFERRAL: '🤝' }

  await createNotification({
    bdId: bd_id,
    type: 'NEW_DEAL_ASSIGNED',
    triggeredBy: NotificationTrigger.STAGE_CHANGE,
    dealId: deal_id,
    content: `${emoji[lead_source] ?? '📋'} New ${lead_source.toLowerCase()} lead: "${deal_name}" from ${client_name}.`,
  })

  logger.info('OnLeadAssigned notification sent', { bd_id, deal_id })
}

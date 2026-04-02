import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { createNotification } from '../../lib/notifications'

const leadAssignedSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  bdId: z.string(),
  assignedById: z.string(),
})

export const config = {
  name: 'OnLeadAssigned',
  description: 'Listens for lead.assigned events and notifies the BD member',
  triggers: [
    {
      type: 'queue' as const,
      topic: 'lead.assigned',
      input: leadAssignedSchema,
    },
  ],
  flows: ['notification-system'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  try {
    const data = leadAssignedSchema.parse(input)
    const { dealId, dealName, bdId } = data

    await createNotification({
      bdId,
      dealId,
      type: 'NEW_DEAL_ASSIGNED',
      triggeredBy: 'STAGE_CHANGE',
      content: `New lead assigned: "${dealName}" has been assigned to you.`,
    })

    logger.info('Lead assignment notification created', { dealId, bdId })
  } catch (error: any) {
    logger.error('Failed to process lead.assigned', { error: error.message, input })
  }
}

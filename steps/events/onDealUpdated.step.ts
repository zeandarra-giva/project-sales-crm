import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../lib/db'

const dealUpdatedSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  bdId: z.string(),
  updatedById: z.string(),
  updatedFields: z.array(z.string()),
})

export const config = {
  name: 'OnDealUpdated',
  description: 'Listens for deal.updated events to update follow-up timestamp and manage deal state',
  triggers: [
    {
      type: 'queue' as const,
      topic: 'deal.updated',
      input: dealUpdatedSchema,
    },
  ],
  flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  try {
    const data = dealUpdatedSchema.parse(input)
    const { dealId, updatedFields } = data

    // Update lastFollowUpAt when remarks or actionPlan are updated
    // This resets the "no follow-up" timer
    const followUpFields = ['remarks', 'actionPlan', 'actionPlanDueDate']
    const hasFollowUpUpdate = updatedFields.some((f) => followUpFields.includes(f))

    if (hasFollowUpUpdate) {
      await prisma.deal.update({
        where: { id: dealId },
        data: { lastFollowUpAt: new Date() },
      })
      logger.info('Updated lastFollowUpAt on deal', { dealId })
    }

    logger.info('onDealUpdated processed', { dealId, updatedFields })
  } catch (error: any) {
    logger.error('Failed to process deal.updated', { error: error.message, input })
  }
}

import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../lib/db'

const dealCreatedSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  bdId: z.string(),
  stageId: z.string(),
  revenue: z.number().nullable().optional(),
  expectedCloseDate: z.union([z.string(), z.date()]).optional(),
})

export const config = {
  name: 'OnDealCreated',
  description: 'Listens for deal.created events to initialize projections and sending assignments',
  triggers: [
    {
      type: 'queue' as const,
      topic: 'deal.created',
      input: dealCreatedSchema,
    },
  ],
  flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  try {
    const data = dealCreatedSchema.parse(input)
    const { dealId, bdId, dealName, revenue, expectedCloseDate } = data

    // 1. Create DealProjection with the deal's starting projected amount
    const projectedAmount = revenue || 0

    await prisma.dealProjection.create({
      data: {
        dealId,
        bdId,
        projectedAmount,
      },
      // Safely ignore if projection already exists somehow
    }).catch(e => logger.warn('Projection might already exist', { e }))

    logger.info('onDealCreated processes completed', { dealId, bdId })
  } catch (error: any) {
    logger.error('Failed to process deal.created', { error: error.message, input })
  }
} 

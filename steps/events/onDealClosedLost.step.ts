import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../lib/db'

const stageChangedSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  previousStageId: z.string(),
  previousStageName: z.string(),
  newStageId: z.string(),
  newStageName: z.string(),
  bdId: z.string(),
  changedById: z.string(),
  isClosed: z.boolean(),
})

export const config = {
  name: 'OnDealClosedLost',
  description: 'Listens for deal.stage.changed and handles Closed Lost: capture final value, compute sales cycle, update projection',
  triggers: [
    {
      type: 'queue' as const,
      topic: 'deal.stage.changed',
      input: stageChangedSchema,
    },
  ],
  flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  try {
    const data = stageChangedSchema.parse(input)

    // Only process Closed Lost transitions
    if (data.newStageName !== 'Closed Lost') return

    const { dealId, bdId, dealName } = data

    // 1. Update DealProjection to 0% probability
    await prisma.dealProjection.updateMany({
      where: { dealId },
      data: {
        probabilityPct: 0,
        weightedValue: 0,
      },
    })

    // 2. Compute and store sales cycle days
    const auditLogs = await prisma.dealAuditLog.findMany({
      where: { dealId },
      orderBy: { enteredAt: 'asc' },
      select: { enteredAt: true },
    })

    if (auditLogs.length > 0) {
      const firstEntry = auditLogs[0].enteredAt
      const salesCycleDays = Math.floor(
        (Date.now() - firstEntry.getTime()) / (1000 * 60 * 60 * 24)
      )
      await prisma.deal.update({
        where: { id: dealId },
        data: { salesCycleDays },
      })
    }

    logger.info('Closed Lost processed', { dealId, bdId, dealName })
  } catch (error: any) {
    logger.error('Failed to process Closed Lost', { error: error.message, input })
  }
}

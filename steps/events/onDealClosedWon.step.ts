import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../lib/prisma.js'

export const config = {
  name: 'OnDealClosedWon',
  description: 'Event: auto-generates Payment records for the full contract duration on Closed Won',
  triggers: [{ type: 'queue' as const, topic: 'deal.closed.won' }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id } = event as { deal_id: string }
  const deal = await prisma.deal.findUnique({ where: { id: deal_id } })
  if (!deal) return

  // Payment uses dateId FK — create without dateId for now (dateId can be linked later)
  const payments = Array.from({ length: deal.duration }, (_, i) => ({
    amount: Number(deal.monthlySubscription),
    dealId: deal_id,
    // dateId is nullable — will be null until DateDimension is populated for future months
  }))

  await prisma.payment.createMany({ data: payments })
  logger.info('OnDealClosedWon: payments generated', { deal_id, months: deal.duration })
}

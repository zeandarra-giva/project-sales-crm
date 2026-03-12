import { type Handlers, type StepConfig } from 'motia'

export const config = {
  name: 'OnDealClosedWon',
  description: 'Event: payments are already generated at Proposal Sent — nothing to do here',
  triggers: [{ type: 'queue' as const, topic: 'deal.closed.won' }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_event, { logger }) => {
  // Payments are auto-generated when the deal reaches Proposal Sent.
  // No action needed here — this handler exists to consume the event cleanly.
  logger.info('OnDealClosedWon: payments already exist from Proposal Sent, skipping regeneration')
}
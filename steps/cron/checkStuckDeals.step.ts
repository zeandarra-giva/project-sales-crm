import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'

export const config = {
  name: 'Check Stuck Deals',
  description: 'Daily 8 AM: find deals stuck beyond stage duration',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 8 * * *', // Every day at 8:00 AM (sec min hour dom mon dow)
    }
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  // Find open deals with their current stage duration
  const stuckDeals = await prisma.$queryRaw`
    SELECT d.id, d.deal_name, d.bd_id, ps.name as stage_name,
    ps.target_duration_days,
    EXTRACT(DAY FROM NOW() - d.last_stage_update_at)::int as days_in_stage
    FROM deal d
    JOIN pipeline_stage ps ON d.stage_id = ps.id
    WHERE d.is_closed = false
    AND EXTRACT(DAY FROM NOW() - d.last_stage_update_at) >
    ps.target_duration_days
  ` as any[]

  for (const deal of stuckDeals) {
    // Avoid duplicate notifications for same deal/day
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: deal.id,
        type: 'DEAL_STUCK',
        createdAt: { gte: today },
      },
    })

    if (!existing) {
      await prisma.notification.create({
        data: {
          bdId: deal.bd_id,
          dealId: deal.id,
          type: 'DEAL_STUCK',
          triggeredBy: 'DAYS_IN_STAGE_EXCEEDED',
          content: `Deal stuck in ${deal.stage_name}: "${deal.deal_name}" has been in ${deal.stage_name} for ${deal.days_in_stage} days (target: ${deal.target_duration_days} days)`,
        },
      })
      logger.info(`Stuck deal notification: ${deal.deal_name}`)
    }
  }

  logger.info(`Checked ${stuckDeals.length} stuck deals`)
}
import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { createNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Action Plan Due',
  description: 'Daily 8 AM: alert BD members when action plan due dates have passed',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 8 * * *',
    },
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const now = new Date()

  // Find open deals with overdue action plans (from the current active audit log)
  const overdueDeals = await prisma.dealAuditLog.findMany({
    where: {
      exitedAt: null, // Current stage entry
      actionPlanDueDate: { lt: now },
      deal: { isClosed: false },
    },
    include: {
      deal: {
        select: { id: true, dealName: true, bdId: true },
      },
    },
  })

  let created = 0
  for (const log of overdueDeals) {
    const daysOverdue = Math.floor(
      (now.getTime() - log.actionPlanDueDate!.getTime()) / (1000 * 60 * 60 * 24)
    )
    const notif = await createNotification({
      bdId: log.deal.bdId,
      dealId: log.deal.id,
      type: 'ACTION_PLAN_DUE',
      triggeredBy: 'ACTION_PLAN_PASSED',
      content: `Action plan overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}: "${log.deal.dealName}" — ${log.actionPlan || 'No action plan set'}`,
    })
    if (notif) created++
  }

  logger.info(`Action plan due check: ${overdueDeals.length} overdue, created ${created} notifications`)
}

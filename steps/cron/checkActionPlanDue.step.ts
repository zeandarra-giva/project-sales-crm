import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { createTeamNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Action Plan Due',
  description: 'Daily 8:15 AM: notify BD members when current action plans are due or overdue',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 15 8 * * *', // sec min hour dom mon dow
    }
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueActions = await prisma.dealAuditLog.findMany({
    where: {
      exitedAt: null,
      actionPlanDueDate: { lte: new Date() },
      deal: {
        isClosed: false,
        contractStatus: { not: 'TERMINATED' },
      },
    },
    include: {
      deal: {
        select: {
          id: true,
          dealName: true,
          bdId: true,
        },
      },
      stage: { select: { name: true } },
    },
  })

  for (const action of dueActions) {
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: action.dealId,
        type: 'ACTION_PLAN_DUE',
        createdAt: { gte: today },
      },
    })

    if (existing) continue

    await createTeamNotification({
      dealId: action.dealId,
      type: 'ACTION_PLAN_DUE',
      triggeredBy: 'ACTION_PLAN_PASSED',
      content: `Action plan for "${action.deal.dealName}" in ${action.stage.name} is due. Review the next steps and update the deal.`,
    }).catch((error) => logger.warn('Failed to create action-plan notification', { error, dealId: action.dealId }))
  }

  logger.info(`Checked ${dueActions.length} due action plans`)
}

import { type Handlers, type StepConfig, cron } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'CheckActionPlanDue',
  description: 'Cron: fires ACTION_PLAN_DUE for deals whose action plan due date is today or overdue',
  triggers: [cron('0 0 7 * * *')],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const overdueDeals = await prisma.deal.findMany({
    where: {
      isClosed: false,
      actionPlanDueDate: { lte: endOfToday },
      actionPlan: { not: null },
    },
    include: { client: { select: { name: true } } },
  })

  let fired = 0
  for (const deal of overdueDeals) {
    const dueDate = deal.actionPlanDueDate!
    const isOverdue = dueDate < now
    const daysOverdue = isOverdue
      ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0

    const content = isOverdue
      ? `🔴 Action plan for "${deal.dealName}" (${deal.client.name}) is ${daysOverdue}d overdue.`
      : `📋 Action plan for "${deal.dealName}" (${deal.client.name}) is due today.`

    await createNotification({
      bdId: deal.bdId,
      type: 'ACTION_PLAN_DUE',
      triggeredBy: NotificationTrigger.ACTION_PLAN_PASSED,
      dealId: deal.id,
      content,
    })
    fired++
  }

  logger.info('CheckActionPlanDue completed', { fired })
}

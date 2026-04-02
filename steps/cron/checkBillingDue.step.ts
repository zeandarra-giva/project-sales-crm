import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { buildCollectionsOverview } from '../../lib/paymentsCollections'
import { createTeamNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Billing Due',
  description: 'Daily 8:30 AM: notify BD members about unpaid or overdue subscription billings',
  triggers: [
    {
      type: 'cron' as const,
      expression: '30 8 * * *',
    }
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const deals = await prisma.deal.findMany({
    where: {
      stage: { name: 'Closed Won' },
    },
    include: {
      bd: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { id: true, name: true, accountType: true } },
      payments: {
        include: {
          date: { select: { year: true, month: true, quarter: true } },
        },
      },
    },
  })

  const overview = buildCollectionsOverview(
    deals.map((deal) => ({
      id: deal.id,
      dealName: deal.dealName,
      monthlySubscription: Number(deal.monthlySubscription || 0),
      revenue: Number(deal.revenue || 0),
      duration: deal.duration,
      startDate: deal.startDate,
      closedDate: deal.closedDate,
      terminatedAt: deal.terminatedAt,
      bdId: deal.bdId,
      bd: deal.bd,
      client: deal.client,
      payments: deal.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        date: payment.date ?? null,
      })),
    }))
  )

  for (const followUp of overview.followUps) {
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: followUp.dealId,
        type: 'FOLLOW_UP_DUE',
        createdAt: { gte: today },
      },
    })

    if (existing) continue

    const content = followUp.followUpStatus === 'Overdue'
      ? `Billing overdue for "${followUp.dealName}". ${followUp.overdueMonths} month(s) remain unpaid totaling ${Math.round(followUp.overdueRevenue)}.`
      : `Billing due this month for "${followUp.dealName}". Next due period: ${followUp.nextDueLabel || 'current billing cycle'}.`

    await createTeamNotification({
      dealId: followUp.dealId,
      type: 'FOLLOW_UP_DUE',
      triggeredBy: 'NO_FOLLOW_UP_IN_14_DAYS',
      content,
    }).catch((error) => logger.warn('Failed to create billing follow-up notification', { error, dealId: followUp.dealId }))
  }

  logger.info(`Checked ${overview.followUps.length} billing follow-up items`)
}

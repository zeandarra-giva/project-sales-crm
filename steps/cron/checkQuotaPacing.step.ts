import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../lib/db'
import { createNotification } from '../../lib/notifications'

export const config = {
  name: 'Check Quota Pacing',
  description: '15th of each month at 8 AM: alert BD members when MTD closed revenue is below 50% of monthly quota',
  triggers: [
    {
      type: 'cron' as const,
      expression: '0 0 8 15 * *', // 15th of every month at 8 AM
    },
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Get first day of current month
  const monthStart = new Date(currentYear, currentMonth - 1, 1)

  // Get all active BD reps
  const bdMembers = await prisma.bD.findMany({
    where: { isActive: true, role: 'BD_REP' },
    select: { id: true, firstName: true, lastName: true },
  })

  let created = 0
  for (const bd of bdMembers) {
    // Get monthly quota for this BD (find target for this month)
    const monthlyTarget = await prisma.target.findFirst({
      where: {
        bdId: bd.id,
        periodType: 'MONTHLY',
        date: {
          year: currentYear,
          month: currentMonth,
        },
      },
    })

    if (!monthlyTarget) continue

    const quota = Number(monthlyTarget.quota)

    // Get MTD closed revenue
    const closedDeals = await prisma.deal.findMany({
      where: {
        bdId: bd.id,
        isClosed: true,
        closedDate: { gte: monthStart },
        stage: { name: 'Closed Won' },
      },
      select: { revenue: true },
    })

    const mtdRevenue = closedDeals.reduce(
      (sum, d) => sum + Number(d.revenue || 0),
      0
    )

    // Alert if MTD < 50% of monthly quota
    const threshold = quota * 0.5
    if (mtdRevenue < threshold) {
      const pct = quota > 0 ? ((mtdRevenue / quota) * 100).toFixed(1) : '0'
      const notif = await createNotification({
        bdId: bd.id,
        type: 'QUOTA_BEHIND_PACE',
        triggeredBy: 'QUOTA_BEHIND_PACE',
        content: `Quota pacing alert: ${bd.firstName} ${bd.lastName} is at ${pct}% of monthly quota (${mtdRevenue.toLocaleString()} / ${quota.toLocaleString()}) at mid-month.`,
      })
      if (notif) created++
    }
  }

  logger.info(`Quota pacing check: ${bdMembers.length} BDs evaluated, ${created} alerts created`)
}

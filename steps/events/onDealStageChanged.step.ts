import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../lib/notifications.js'
import { NotificationTrigger } from '@prisma/client'

export const config = {
  name: 'OnDealStageChanged',
  description: 'Event: fires STAGE_CHANGE notification and auto-generates payments on Proposal Sent',
  triggers: [{ type: 'queue' as const, topic: 'deal.stage.changed' }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function generatePayments(deal_id: string, logger: any) {
  const deal = await prisma.deal.findUnique({
    where: { id: deal_id },
    select: { startDate: true, dueDate: true, duration: true, monthlySubscription: true },
  })

  if (!deal?.startDate || !deal?.monthlySubscription) {
    logger.warn('Skipping payment generation — deal missing startDate or monthlySubscription', { deal_id })
    return
  }

  const months = deal.duration > 0 ? deal.duration : 1

  // Clear and regenerate — idempotent if event fires more than once
  await prisma.payment.deleteMany({ where: { dealId: deal_id } })

  for (let i = 0; i < months; i++) {
    const d = new Date(deal.startDate)
    d.setMonth(d.getMonth() + i)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const quarter = Math.ceil(month / 3)
    const dateId = `${year}-${String(month).padStart(2, '0')}`

    await prisma.dateDimension.upsert({
      where: { id: dateId },
      update: {},
      create: {
        id: dateId,
        timestamp: new Date(year, month - 1, 1),
        year,
        month,
        monthNumber: month,
        day: 1,
        dayOfWeek: DAY_NAMES[new Date(year, month - 1, 1).getDay()],
        quarter,
        isQuarterEnd: month % 3 === 0,
      },
    })

    await prisma.payment.create({
      data: {
        dealId: deal_id,
        amount: deal.monthlySubscription, // expected amount — BD can edit actual received
        dateId,
      },
    })
  }

  logger.info('Auto-generated monthly payments', { deal_id, months })
}

export const handler: Handlers<typeof config> = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, old_stage, new_stage } = event as {
    deal_id: string; bd_id: string; deal_name: string; old_stage: string; new_stage: string
  }

  const emoji = new_stage === 'Closed Won' ? '🎉'
    : new_stage === 'Closed Lost' ? '❌'
      : new_stage === 'Negotiation' ? '🤝'
        : new_stage === 'Proposal Sent' ? '📄'
          : '🔄'

  // Stage change notification to BD owner
  await createNotification({
    bdId: bd_id,
    type: 'STAGE_CHANGE',
    triggeredBy: NotificationTrigger.STAGE_CHANGE,
    dealId: deal_id,
    content: `${emoji} "${deal_name}" moved from ${old_stage} → ${new_stage}.`,
  })

  // ── Auto-generate monthly payment schedule on Proposal Sent ────────────
  // Payments represent expected monthly subscription collections.
  // BD can later edit each month's amount to reflect what was actually received.
  if (new_stage === 'Proposal Sent') {
    await generatePayments(deal_id, logger)
  }

  // ── Notify managers on Closed Won / Closed Lost ────────────────────────
  if (new_stage === 'Closed Won' || new_stage === 'Closed Lost') {
    const [managers, deal] = await Promise.all([
      prisma.bD.findMany({ where: { role: 'SALES_MANAGER', isActive: true }, select: { id: true } }),
      prisma.deal.findUnique({
        where: { id: deal_id },
        include: {
          client: { select: { name: true } },
          bd: { select: { firstName: true, lastName: true } },
        },
      }),
    ])
    const bdName = deal?.bd ? `${deal.bd.firstName} ${deal.bd.lastName}` : 'BD'
    const revenue = deal?.revenue ? ` — ₱${Number(deal.revenue).toLocaleString()}` : ''

    for (const mgr of managers) {
      if (mgr.id === bd_id) continue
      await createNotification({
        bdId: mgr.id,
        type: 'STAGE_CHANGE',
        triggeredBy: NotificationTrigger.STAGE_CHANGE,
        dealId: deal_id,
        content: `${emoji} ${bdName}'s deal "${deal_name}" (${deal?.client?.name}) was marked ${new_stage}${revenue}.`,
      })
    }
  }

  logger.info('OnDealStageChanged processed', { deal_id, old_stage, new_stage })
}
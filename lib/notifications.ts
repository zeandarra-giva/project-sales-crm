import { prisma } from './db'

type NotificationPayload = {
  bdId: string
  type: 'STAGE_CHANGE' | 'DEAL_STUCK' | 'ACTION_PLAN_DUE' | 'FOLLOW_UP_DUE' | 'QUOTA_BEHIND_PACE' | 'NEW_DEAL_ASSIGNED' | 'LOST_DEAL_FOLLOW_UP'
  triggeredBy: 'STAGE_CHANGE' | 'ACTION_PLAN_PASSED' | 'DAYS_IN_STAGE_EXCEEDED' | 'NO_FOLLOW_UP_IN_14_DAYS' | 'QUOTA_BEHIND_PACE' | 'CLOSED_LOST_AGE'
  content: string
  dealId?: string | null
  scheduledAt?: Date | null
}

export async function createNotification(payload: NotificationPayload) {
  return prisma.notification.create({
    data: {
      bdId: payload.bdId,
      type: payload.type,
      triggeredBy: payload.triggeredBy,
      content: payload.content,
      ...(payload.dealId ? { dealId: payload.dealId } : {}),
      ...(payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : {}),
    },
  })
}

export async function createTeamNotification(payload: Omit<NotificationPayload, 'bdId'>) {
  const recipients = await prisma.bD.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  if (recipients.length === 0) {
    return { count: 0 }
  }

  return prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      bdId: recipient.id,
      type: payload.type,
      triggeredBy: payload.triggeredBy,
      content: payload.content,
      dealId: payload.dealId ?? null,
      scheduledAt: payload.scheduledAt ?? null,
    })),
  })
}

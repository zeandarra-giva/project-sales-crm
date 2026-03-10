import { NotificationType, NotificationTrigger } from '@prisma/client'
import { prisma } from './prisma.js'

interface CreateNotificationArgs {
  bdId:        string
  type:        NotificationType
  triggeredBy: NotificationTrigger
  content:     string
  dealId?:     string
  scheduledAt?: Date
}

// Deal-level types deduped: one unread per deal per day
const DEDUP_TYPES: NotificationType[] = [
  NotificationType.DEAL_STUCK,
  NotificationType.ACTION_PLAN_DUE,
  NotificationType.FOLLOW_UP_DUE,
  NotificationType.LOST_DEAL_FOLLOW_UP,
]

export async function createNotification(args: CreateNotificationArgs): Promise<void> {
  if (DEDUP_TYPES.includes(args.type) && args.dealId) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const existing = await prisma.notification.findFirst({
      where: {
        bdId:      args.bdId,
        type:      args.type,
        dealId:    args.dealId,
        isRead:    false,
        createdAt: { gte: startOfDay },
      },
    })
    if (existing) return
  }
  await prisma.notification.create({
    data: {
      bdId:        args.bdId,
      type:        args.type,
      triggeredBy: args.triggeredBy,
      content:     args.content,
      dealId:      args.dealId,
      scheduledAt: args.scheduledAt,
    },
  })
}

/** Quota alert: one unread QUOTA_BEHIND_PACE per BD per day */
export async function createQuotaNotification(
  args: Omit<CreateNotificationArgs, 'dealId'>
): Promise<void> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const existing = await prisma.notification.findFirst({
    where: {
      bdId:      args.bdId,
      type:      NotificationType.QUOTA_BEHIND_PACE,
      isRead:    false,
      createdAt: { gte: startOfDay },
    },
  })
  if (existing) return
  await prisma.notification.create({
    data: {
      bdId:        args.bdId,
      type:        args.type,
      triggeredBy: args.triggeredBy,
      content:     args.content,
    },
  })
}

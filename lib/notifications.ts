import { prisma } from './db'
import { logger } from 'motia'
import type { NotificationType, NotificationTrigger } from '@prisma/client'

type NotificationPayload = {
  bdId: string
  type: NotificationType
  triggeredBy: NotificationTrigger
  content: string
  dealId?: string | null
  scheduledAt?: Date | null
}

/**
 * Create a notification, skipping duplicates for the same deal+type on the same day.
 */
export async function createNotification(payload: NotificationPayload) {
  // Deduplicate: skip if same deal+type already created today
  if (payload.dealId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: payload.dealId,
        type: payload.type,
        createdAt: { gte: today },
      },
    })
    if (existing) {
      logger.info(`Skipped duplicate ${payload.type} notification for deal ${payload.dealId}`)
      return null
    }
  }

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

/**
 * Create notifications for all active BD members (team-wide alerts).
 */
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

import { prisma } from './db'
import { logger } from 'motia'
import type { NotificationType, NotificationTrigger } from '@prisma/client'

interface CreateNotificationInput {
  bdId: string
  dealId?: string | null
  type: NotificationType
  triggeredBy: NotificationTrigger
  content: string
  scheduledAt?: Date | null
}

/**
 * Create a notification, skipping duplicates for the same deal+type on the same day.
 * Returns the created notification or null if a duplicate was found.
 */
export async function createNotification(input: CreateNotificationInput) {
  const { bdId, dealId, type, triggeredBy, content, scheduledAt } = input

  // Deduplicate: skip if same deal+type already created today
  if (dealId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existing = await prisma.notification.findFirst({
      where: {
        dealId,
        type,
        createdAt: { gte: today },
      },
    })
    if (existing) {
      logger.info(`Skipped duplicate ${type} notification for deal ${dealId}`)
      return null
    }
  }

  const notification = await prisma.notification.create({
    data: {
      bdId,
      dealId: dealId || undefined,
      type,
      triggeredBy,
      content,
      scheduledAt,
    },
  })

  logger.info(`Created ${type} notification for BD ${bdId}`, { dealId })
  return notification
}

/**
 * Create notifications for both the BD rep and the manager (if different).
 */
export async function notifyBdAndManager(
  bdId: string,
  dealId: string,
  type: NotificationType,
  triggeredBy: NotificationTrigger,
  content: string,
) {
  // Notify the BD rep
  await createNotification({ bdId, dealId, type, triggeredBy, content })

  // Also notify the manager(s)
  const managers = await prisma.bD.findMany({
    where: { role: 'SALES_MANAGER', isActive: true },
    select: { id: true },
  })

  for (const mgr of managers) {
    if (mgr.id !== bdId) {
      await createNotification({
        bdId: mgr.id,
        dealId,
        type,
        triggeredBy,
        content: `[Team] ${content}`,
      })
    }
  }
}

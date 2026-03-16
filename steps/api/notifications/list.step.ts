import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetNotifications',
  description: 'Get notifications for the authenticated BD member',
  triggers: [{ type: 'http' as const, path: '/api/notifications', method: 'GET' as const }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>

  const notifications = await prisma.notification.findMany({
    where: {
      bdId: user!.id,
      isRead: q.unread_only === 'true' ? false : undefined,
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: new Date() } },
      ],
    },
    include: {
      deal: {
        select: {
          id: true,
          dealName: true,
          stage: { select: { name: true } },
          client: { select: { name: true, accountType: true } },
          bd: { select: { firstName: true, lastName: true, role: true } },
          auditLogs: {
            orderBy: { enteredAt: 'asc' },
            select: {
              id: true,
              enteredAt: true,
              exitedAt: true,
              daysInStage: true,
              remarks: true,
              actionPlan: true,
              actionPlanDueDate: true,
              stage: { select: { name: true } },
              changedBy: { select: { firstName: true, lastName: true } },
            } as any,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Slice each deal's audit logs to only those that existed at notification creation time
  const notificationsWithSnapshot = notifications.map(n => {
    if (!n.deal) return n
    const createdAt = n.createdAt
    const logsAtTime = (n.deal.auditLogs as any[]).filter(
      (log: any) => new Date(log.enteredAt) <= createdAt
    )
    return {
      ...n,
      deal: { ...n.deal, auditLogs: logsAtTime },
    }
  })

  const unreadCount = await prisma.notification.count({
    where: {
      bdId: user!.id,
      isRead: false,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
  })

  logger.info('Notifications fetched', { count: notifications.length })
  return { status: 200, body: { notifications: notificationsWithSnapshot, unreadCount } }
}
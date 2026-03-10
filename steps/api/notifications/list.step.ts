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
      bdId:   user!.id,
      isRead: q.unread_only === 'true' ? false : undefined,
    },
    include: { deal: { select: { id: true, dealName: true, stage: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({ where: { bdId: user!.id, isRead: false } })

  logger.info('Notifications fetched', { count: notifications.length })
  return { status: 200, body: { notifications, unreadCount } }
}

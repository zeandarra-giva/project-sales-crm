import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'MarkAllNotificationsRead',
  description: 'Mark all notifications as read for the current user',
  triggers: [{ type: 'http' as const, path: '/api/notifications/read-all', method: 'PATCH' as const }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { count } = await prisma.notification.updateMany({
    where: { bdId: user!.id, isRead: false },
    data:  { isRead: true },
  })
  logger.info('All notifications marked read', { count })
  return { status: 200, body: { updated: count } }
}

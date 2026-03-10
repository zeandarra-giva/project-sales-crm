import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'MarkNotificationRead',
  description: 'Mark a single notification as read',
  triggers: [{ type: 'http' as const, path: '/api/notifications/:id/read', method: 'PATCH' as const }],
  enqueues: [],
  flows: ['notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return { status: 404, body: { error: 'Notification not found' } }
  if (notification.bdId !== user!.id) return { status: 403, body: { error: 'Forbidden' } }

  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  logger.info('Notification marked read', { id })
  return { status: 200, body: { ok: true } }
}

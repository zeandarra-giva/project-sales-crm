import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'MarkAllNotificationsRead',
    description: 'Mark all of the authenticated user\'s notifications as read',
    triggers: [
        // Path matches frontend: apiClient.post('/api/notifications/read-all')
        { type: 'http' as const, method: 'POST' as const, path: '/api/notifications/read-all' },
    ],
    enqueues: [],
    flows: ['notification-system'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const result = await prisma.notification.updateMany({
            where: { bdId: user.id, isRead: false },
            data: { isRead: true },
        })

        return {
            status: 200,
            body: { success: true, updated: result.count },
        }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to mark all notifications read', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'MarkNotificationRead',
    description: 'Mark a single notification as read',
    triggers: [
        // Path matches frontend: apiClient.patch(`/api/notifications/${id}/read`)
        { type: 'http' as const, method: 'PATCH' as const, path: '/api/notifications/:id/read' },
    ],
    enqueues: [],
    flows: ['notification-system'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams

        const notification = await prisma.notification.findUnique({ where: { id } })

        if (!notification) {
            return { status: 404, body: { error: 'Notification not found' } }
        }

        // Users can only update their own notifications
        if (notification.bdId !== user.id) {
            return { status: 403, body: { error: 'Not your notification' } }
        }

        await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        })

        return { status: 200, body: { success: true } }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to mark notification read', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

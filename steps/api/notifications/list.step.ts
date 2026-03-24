import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'ListNotifications',
    description: 'List notifications for the authenticated BD member with unread count (FR-ADD-010)',
    triggers: [
        // Path matches frontend api/notifications.ts: apiClient.get('/notifications')
        { type: 'http' as const, method: 'GET' as const, path: '/notifications' },
    ],
    enqueues: [],
    flows: ['notification-system'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const notifications = await prisma.notification.findMany({
            where: { bdId: user.id },
            include: {
                deal: { select: { id: true, dealName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        const unreadCount = await prisma.notification.count({
            where: { bdId: user.id, isRead: false },
        })

        // Prisma enum → frontend PascalCase (STAGE_CHANGE → StageChange)
        const TYPE_MAP: Record<string, string> = {
            STAGE_CHANGE:        'StageChange',
            DEAL_STUCK:          'DealStuck',
            ACTION_PLAN_DUE:     'ActionPlanDue',
            FOLLOW_UP_DUE:       'FollowUpDue',
            QUOTA_BEHIND_PACE:   'QuotaAlert',
            NEW_DEAL_ASSIGNED:   'NewDealAssigned',
            LOST_DEAL_FOLLOW_UP: 'LostDealFollowUp',
        }

        // Map to frontend snake_case shape (matches Notification type in frontend/src/types/notification.ts)
        const mapped = notifications.map((n) => ({
            id: n.id,
            content: n.content,
            type: TYPE_MAP[n.type] ?? n.type,
            is_read: n.isRead,
            triggered_by: n.triggeredBy,
            scheduled_at: n.scheduledAt?.toISOString() ?? null,
            created_at: n.createdAt.toISOString(),
            bd_id: n.bdId,
            deal_id: n.dealId ?? null,
            deal: n.deal ? { id: n.deal.id, deal_name: n.deal.dealName } : null,
        }))

        return {
            status: 200,
            body: { notifications: mapped, unreadCount },
        }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list notifications', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

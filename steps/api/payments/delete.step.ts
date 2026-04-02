import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { createTeamNotification } from '../../../lib/notifications'

export const config = {
    name: 'DeletePayment',
    description: 'Delete a payment log',
    triggers: [
        { type: 'http', method: 'DELETE', path: '/api/payments/:id' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can delete payment logs' } }
        }

        const { id } = req.request.pathParams
        const existing = await prisma.payment.findUnique({
            where: { id },
            include: {
                deal: { select: { id: true, dealName: true } },
                date: { select: { year: true, month: true } },
            },
        })

        if (!existing) {
            return { status: 404, body: { error: 'Payment not found' } }
        }

        await prisma.payment.delete({ where: { id } })

        await createTeamNotification({
            dealId: existing.dealId,
            type: 'FOLLOW_UP_DUE',
            triggeredBy: 'NO_FOLLOW_UP_IN_14_DAYS',
            content: `Payment log for "${existing.deal.dealName}" was deleted${existing.date ? ` (${existing.date.month}/${existing.date.year})` : ''}.`,
        }).catch((error) => logger.warn('Failed to create team payment-delete notification', { error, paymentId: id }))

        return { status: 200, body: { success: true, id } }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to delete payment', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

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
        await prisma.payment.delete({ where: { id } })
        return { status: 200, body: { success: true, id } }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (error.code === 'P2025') {
            return { status: 404, body: { error: 'Payment not found' } }
        }
        logger.error('Failed to delete payment', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'DeleteService',
    description: 'Soft-deletes (deactivates) a service',
    triggers: [
        { type: 'http' as const, method: 'DELETE' as const, path: '/api/services/:id' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can manage services' } }
        }

        const { id } = req.request.pathParams

        // Soft-delete: mark inactive rather than hard delete to preserve deal history
        const service = await prisma.service.update({
            where: { id },
            data: { isActive: false },
        })

        return { status: 200, body: { success: true, id: service.id } }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2025') return { status: 404, body: { error: 'Service not found' } }
        logger.error('Failed to delete service', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'RemoveServiceFromBundle',
    description: 'Removes a service from a bundle',
    triggers: [
        { type: 'http' as const, method: 'DELETE' as const, path: '/api/bundles/:bundleId/services/:serviceId' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can manage bundles' } }
        }

        const { bundleId, serviceId } = req.request.pathParams

        await prisma.bundleService.delete({
            where: { serviceId_bundleId: { serviceId, bundleId } },
        })

        return { status: 200, body: { success: true } }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2025') return { status: 404, body: { error: 'Service not found in this bundle' } }
        logger.error('Failed to remove service from bundle', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

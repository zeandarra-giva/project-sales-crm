import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'DeleteBundle',
    description: 'Deletes a bundle (only if it has no active deals)',
    triggers: [
        { type: 'http' as const, method: 'DELETE' as const, path: '/api/bundles/:id' },
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

        const { id } = req.request.pathParams

        // Guard: don't delete bundles with active deals
        const dealCount = await prisma.deal.count({ where: { bundleId: id } })
        if (dealCount > 0) {
            return {
                status: 409,
                body: { error: `Cannot delete bundle — it is used by ${dealCount} deal(s)` },
            }
        }

        // Remove all bundleService rows first (cascade not set), then delete bundle
        await prisma.bundleService.deleteMany({ where: { bundleId: id } })
        await prisma.bundle.delete({ where: { id } })

        return { status: 200, body: { success: true, id } }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2025') return { status: 404, body: { error: 'Bundle not found' } }
        logger.error('Failed to delete bundle', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

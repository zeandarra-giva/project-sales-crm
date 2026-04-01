import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListBundles',
    description: 'Returns all bundles with their included services',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/bundles' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        await authenticate(req.request)

        const bundles = await prisma.bundle.findMany({
            include: {
                bundleServices: {
                    include: { service: true },
                    orderBy: { service: { name: 'asc' } },
                },
            },
            orderBy: { name: 'asc' },
        })

        return { status: 200, body: bundles }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        logger.error('Failed to list bundles', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

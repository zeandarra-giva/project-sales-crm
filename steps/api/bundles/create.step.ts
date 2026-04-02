import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'CreateBundle',
    description: 'Creates a new bundle',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/bundles',
            bodySchema: z.object({
                name: z.string().min(1),
            }),
        },
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

        const { name } = req.request.body

        const bundle = await prisma.bundle.create({
            data: { name: name.trim() },
            include: {
                bundleServices: { include: { service: true } },
            },
        })

        return { status: 201, body: bundle }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        logger.error('Failed to create bundle', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

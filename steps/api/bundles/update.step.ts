import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'UpdateBundle',
    description: 'Updates a bundle name',
    triggers: [
        {
            type: 'http' as const,
            method: 'PATCH' as const,
            path: '/api/bundles/:id',
            bodySchema: z.object({
                name: z.string().min(1).optional(),
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

        const { id } = req.request.pathParams
        const { name } = req.request.body

        const bundle = await prisma.bundle.update({
            where: { id },
            data: { ...(name !== undefined && { name: name.trim() }) },
            include: {
                bundleServices: { include: { service: true } },
            },
        })

        return { status: 200, body: bundle }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2025') return { status: 404, body: { error: 'Bundle not found' } }
        logger.error('Failed to update bundle', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

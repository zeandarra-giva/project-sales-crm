import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'AddServiceToBundle',
    description: 'Adds a service to a bundle with value and revenue-share configuration',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/bundles/:bundleId/services',
            bodySchema: z.object({
                serviceId: z.string().uuid(),
                name: z.string().min(1),
                serviceValue: z.number().min(0),
                revenueSharePct: z.number().min(0).max(100),
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

        const { bundleId } = req.request.pathParams
        const { serviceId, name, serviceValue, revenueSharePct } = req.request.body

        const bundleService = await prisma.bundleService.create({
            data: {
                bundleId,
                serviceId,
                name: name.trim(),
                serviceValue,
                revenueSharePct,
            },
            include: { service: true },
        })

        return { status: 201, body: bundleService }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2002') return { status: 409, body: { error: 'This service is already in the bundle' } }
        if (error.code === 'P2003') return { status: 404, body: { error: 'Bundle or service not found' } }
        logger.error('Failed to add service to bundle', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

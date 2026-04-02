import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'UpdateService',
    description: 'Updates an existing service',
    triggers: [
        {
            type: 'http' as const,
            method: 'PATCH' as const,
            path: '/api/services/:id',
            bodySchema: z.object({
                name: z.string().min(1).optional(),
                description: z.string().optional(),
                isActive: z.boolean().optional(),
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
            return { status: 403, body: { error: 'Only managers can manage services' } }
        }

        const { id } = req.request.pathParams
        const { name, description, isActive } = req.request.body

        const service = await prisma.service.update({
            where: { id },
            data: {
                ...(name !== undefined      && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(isActive !== undefined  && { isActive }),
            },
        })

        return { status: 200, body: service }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2025') return { status: 404, body: { error: 'Service not found' } }
        if (error.code === 'P2002') return { status: 409, body: { error: 'A service with this name already exists' } }
        logger.error('Failed to update service', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

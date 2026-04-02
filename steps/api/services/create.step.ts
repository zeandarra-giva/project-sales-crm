import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'CreateService',
    description: 'Creates a new service',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/services',
            bodySchema: z.object({
                name: z.string().min(1),
                description: z.string().optional(),
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

        const { name, description } = req.request.body

        const service = await prisma.service.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                isActive: true,
            },
        })

        return { status: 201, body: service }
    } catch (error: any) {
        if (error.name === 'AuthError') return { status: 401, body: { error: error.message } }
        if (error.code === 'P2002') return { status: 409, body: { error: 'A service with this name already exists' } }
        logger.error('Failed to create service', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

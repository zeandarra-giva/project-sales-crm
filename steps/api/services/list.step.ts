import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListServices',
    description: 'Returns all active services',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/services' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        await authenticate(req.request)

        const services = await prisma.service.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        })

        return { status: 200, body: services }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list services', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'ListClients',
    description: 'Get list of all clients',
    triggers: [
        {
            type: 'http' as const,
            method: 'GET' as const,
            path: '/api/clients',
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    try {
        const user = await authenticate(req)
        logger.info('Listing clients', { userId: user.id })


        const clients = await prisma.client.findMany({
            include: {
                industry: true,  // join the industry name
                contacts: true,  // all contacts for this client
                contact: true,  // the primary contact
                _count: { select: { deals: true } }, // how many deals
            },
            orderBy: {
                name: 'asc'
            },
        })

        return { status: 200, body: clients }

    } catch (error: any) {
        logger.warn('Failed to list clients', { error: error.message })
        return {
            status: error.message === 'Not authenticated' ? 401 : 500,
            body: { error: error.message },
        }
    }
}

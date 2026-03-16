import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'GetClientDetail',
    description: 'Get a single client by ID',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/clients/:id' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        // 1. Authenticate the user
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams      // Motia extracts :id from the URL

        // 2. Fetch the client
        const client = await prisma.client.findUnique({
            where: { id },
            include: {
                industry: true,
                contact: true,                          // primary contact
                contacts: true,                         // all contacts
                deals: {                                  // all deals for this client
                    include: {
                        stage: true,
                        bd: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
                referredBy: true,                      // who referred this client
            },
        })

        // 3. Handle not found
        if (!client) {
            return { status: 404, body: { error: 'Client not found' } }
        }

        // 4. Return success
        return { status: 200, body: client }

    } catch (error: any) {
        // 5. Catch errors cleanly (401 for AuthError, 500 for everything else)
        logger.error('Failed to get client details', { error: error.message, clientId: req.request.pathParams.id })

        return {
            status: error.name === 'AuthError' ? 401 : 500,
            body: { error: error.message || 'Internal Server Error' },
        }
    }
}
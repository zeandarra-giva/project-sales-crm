import { StepConfig, Handlers } from 'motia'
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

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    const user = await authenticate(req)
    const { id } = req.pathParams      // Motia extracts :id from the URL

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

    if (!client) {
        return { status: 404, body: { error: 'Client not found' } }
    }

    return { status: 200, body: client }
}
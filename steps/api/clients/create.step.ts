import { StepConfig, Handlers } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'CreateClient',
    description: 'Create a new client',
    triggers: [{
        type: 'http',
        method: 'POST',
        path: '/api/clients',
        bodySchema: z.object({                     // Zod validates BEFORE handler runs
            name: z.string().min(1),           // required
            brand: z.string().optional(),
            accountType: z.enum(['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT']),
            status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).default('PROSPECT'),
            industryId: z.string().optional(),
            referralId: z.string().optional(),
        }),
    }],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    const user = await authenticate(req)
    const { name, brand, accountType, status, industryId, referralId } = req.body

    const client = await prisma.client.create({
        data: { name, brand, accountType, status, industryId, referralId },
        include: { industry: true, contacts: true },
    })

    logger.info('Client created', { clientId: client.id, by: user.id })
    return { status: 201, body: client }
}
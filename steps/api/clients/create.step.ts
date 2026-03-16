import type { StepConfig, Handlers } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma } from '@prisma/client'

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
    try {
        // 1. Authenticate the user
        const user = await authenticate(req)
        const { name, brand, accountType, status, industryId, referralId } = req.body

        // 2. Create the client in the database
        const client = await prisma.client.create({
            data: { name, brand, accountType, status, industryId, referralId },
            include: { industry: true, contacts: true },
        })

        // 3. Log success and return 201 Created
        logger.info('Client created', { clientId: client.id, by: user.id })
        return { status: 201, body: client }

    } catch (error: any) {
        // 4. Catch and handle errors cleanly
        if (error.name === 'AuthError') {                // ← Refactor 2
            return { status: 401, body: { error: error.message } }
        }
        if (                                             // ← Refactor 4
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === 'P2025' || error.code === 'P2003')
        ) {
            return { status: 400, body: { error: 'Related record not found (check industryId, referralId)' } }
        }
        logger.error('Failed to create client', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
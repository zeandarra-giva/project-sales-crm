import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma, type ClientStatus, type AccountType } from '@prisma/client'

export const config = {
    name: 'UpdateClient',
    description: 'Update an existing client',
    triggers: [{
        type: 'http',
        method: 'PATCH',
        path: '/api/clients/:id',
        bodySchema: z.object({
            name: z.string().min(1).optional(),   // all optional for partial update
            brand: z.string().optional(),
            accountType: z.enum(['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT']).optional(),
            status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).optional(),
            industryId: z.string().optional(),
            contactId: z.string().optional(),          // set primary contact
        }),
    }],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        // 1. Authenticate
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams

        // 2. Ensure the client exists before updating
        const existing = await prisma.client.findUnique({ where: { id } })
        if (!existing) {
            return { status: 404, body: { error: 'Client not found' } }
        }

        const { industryId, contactId, ...body } = req.request.body

        // 3. Perform the update
        const updated = await prisma.client.update({
            where: { id },
            data: {
                // Scalar fields
                ...(body.name && { name: body.name }),
                ...(body.brand !== undefined && { brand: body.brand }),
                ...(body.accountType && { accountType: body.accountType as AccountType }),
                ...(body.status && { status: body.status as ClientStatus }),

                // Relation fields
                ...(industryId && { industry: { connect: { id: industryId } } }),
                ...(contactId && { contact: { connect: { id: contactId } } }),
            },
            include: { industry: true, contacts: true, contact: true },
        })

        logger.info('Client updated', { clientId: id, by: user.id })
        return { status: 200, body: updated }

    } catch (error: any) {
        logger.error('Failed to update client', { error: error.message, clientId: req.request.pathParams?.id })

        // Check for our AuthError (401)
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }

        // Check for Prisma's specific "Record to connect not found" error (400)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return {
                status: 400,
                body: { error: 'Record not found or related ID is invalid' }
            }
        }

        // Fallback for everything else (500)
        return {
            status: 500,
            body: { error: error.message || 'Internal Server Error' },
        }
    }
}
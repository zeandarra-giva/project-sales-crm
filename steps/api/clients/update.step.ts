import { StepConfig, Handlers } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import type { ClientStatus, AccountType } from '@prisma/client'

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
            status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'DORMANT']).optional(),
            industryId: z.string().optional(),
            contactId: z.string().optional(),          // set primary contact
        }),
    }],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    const user = await authenticate(req)
    const { id } = req.pathParams

    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
        return { status: 404, body: { error: 'Client not found' } }
    }

    const { industryId, contactId, ...body } = req.body

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
}
import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'UpdateContact',
    description: 'Update an existing contact',
    triggers: [{
        type: 'http',
        method: 'PATCH',
        path: '/api/contacts/:id',
        bodySchema: z.object({
            firstName: z.string().min(1).optional(),
            lastName: z.string().min(1).optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            jobTitle: z.string().optional(),
            decisionMakerTier: z.number().min(1).max(5).optional(),
            isPrimary: z.boolean().optional(),
        }),
    }],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams
        const { phone, jobTitle, decisionMakerTier, ...rest } = req.request.body

        // Map decision-maker tier (1-5) to Prisma Enum
        const rankMapping: Record<number, string> = {
            1: 'TIER_1_ECONOMIC_BUYER',
            2: 'TIER_2_DECISION_MAKER',
            3: 'TIER_3_INFLUENCER',
            4: 'TIER_4_END_USER',
            5: 'TIER_5_GATEKEEPER'
        }

        const contact = await prisma.$transaction(async (tx) => {
            const updatedContact = await tx.contact.update({
                where: { id },
                data: {
                    ...rest,
                    ...(phone && { number: phone }),
                    ...(jobTitle && { designation: jobTitle }),
                    ...(decisionMakerTier && { decisionRank: rankMapping[decisionMakerTier] as any }),
                },
                include: { client: { select: { id: true, name: true } } },
            })

            // If promoted to primary, update the parent client
            if (req.request.body.isPrimary) {
                await tx.client.update({
                    where: { id: updatedContact.clientId },
                    data: { contactId: updatedContact.id },
                })
            }
            return updatedContact
        })

        logger.info('Contact updated', { contactId: id, by: user.id })
        return { status: 200, body: contact }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return { status: 404, body: { error: 'Contact not found' } }
        }
        logger.error('Failed to update contact', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
import { type StepConfig, type Handlers, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'CreateContact',
    description: 'Create a new contact',
    triggers: [{
        type: 'http',
        method: 'POST',
        path: '/api/contacts',
        bodySchema: z.object({
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            email: z.string().email(),             // email is required in the DB
            phone: z.string().optional(),          // maps to 'number' in DB
            jobTitle: z.string().optional(),       // maps to 'designation' in DB
            decisionMakerTier: z.number().min(1).max(5).default(3),
            clientId: z.string().min(1),
            isPrimary: z.boolean().default(false),
        }),
    }],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { firstName, lastName, email, phone, jobTitle,
            decisionMakerTier, clientId, isPrimary } = req.request.body

        // Map decision-maker tier (1-5) to Prisma Enum
        const rankMapping: Record<number, any> = {
            1: 'TIER_1_ECONOMIC_BUYER',
            2: 'TIER_2_DECISION_MAKER',
            3: 'TIER_3_INFLUENCER',
            4: 'TIER_4_END_USER',
            5: 'TIER_5_GATEKEEPER'
        }

        const contact = await prisma.$transaction(async (tx) => {
            const newContact = await tx.contact.create({
                data: {
                    firstName,
                    lastName,
                    email,
                    number: phone,                // map phone -> number
                    designation: jobTitle,        // map jobTitle -> designation
                    decisionRank: rankMapping[decisionMakerTier] || 'TIER_3_INFLUENCER',
                    clientId,
                    isPrimary,
                },
                include: { client: { select: { id: true, name: true } } },
            })

            // If this contact is marked primary, update the client table
            if (isPrimary) {
                await tx.client.update({
                    where: { id: clientId },
                    data: { contactId: newContact.id },
                })
            }
            return newContact
        })

        logger.info('Contact created', { contactId: contact.id, by: user.id })
        return { status: 201, body: contact }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === 'P2025' || error.code === 'P2003')
        ) {
            return { status: 400, body: { error: 'Client not found — check clientId' } }
        }
        if (
            error instanceof Prisma.PrismaClientValidationError ||
            (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2000')
        ) {
            return { status: 400, body: { error: 'Invalid input — check field lengths and types' } }
        }
        logger.error('Failed to create contact', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
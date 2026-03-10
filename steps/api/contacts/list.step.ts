import type { StepConfig, Handlers } from "motia";
import { prisma } from "../../../lib/db";
import { authenticate } from "../../../lib/auth";

export const config = {
    name: 'ListContacts',
    description: 'Get list of all contacts',
    triggers: [
        {
            type: 'http' as const,
            method: 'GET' as const,
            path: '/api/contacts',
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    try {
        const user = await authenticate(req)
        logger.info('Listing contacts', { userId: user.id })

        const contacts = await prisma.contact.findMany({
            include: {
                client: {                                  // which company they belong to
                    select: { id: true, name: true, accountType: true },
                },
                _count: { select: { dealContacts: true } },       // how many deals they're on
            },
            orderBy: { lastName: 'asc' },
        })

        return { status: 200, body: contacts }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list contacts', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
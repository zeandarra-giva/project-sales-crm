import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma } from '@prisma/client'

const bodySchema = z.object({
    label: z.string().min(1).max(120),
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4).optional(),
    revenue: z.number().min(0),
    notes: z.string().optional(),
})

export const config = {
    name: 'CreateGrowthEntry',
    description: 'Create a growth table row',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/growth-entries',
            bodySchema,
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        const { label, year, quarter, revenue, notes } = req.request.body

        const entry = await prisma.growthEntry.create({
            data: {
                label,
                year,
                quarter: quarter ?? null,
                revenue: new Prisma.Decimal(revenue),
                notes,
                ownerId: user.id,
            },
            include: {
                owner: { select: { id: true, firstName: true, lastName: true } },
            },
        })

        return {
            status: 201,
            body: {
                ...entry,
                revenue: Number(entry.revenue),
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to create growth entry', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

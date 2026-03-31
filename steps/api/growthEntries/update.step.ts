import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { Prisma } from '@prisma/client'

const bodySchema = z.object({
    label: z.string().min(1).max(120).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    quarter: z.number().int().min(1).max(4).nullable().optional(),
    revenue: z.number().min(0).optional(),
    notes: z.string().nullable().optional(),
})

export const config = {
    name: 'UpdateGrowthEntry',
    description: 'Update a growth table row',
    triggers: [
        {
            type: 'http' as const,
            method: 'PATCH' as const,
            path: '/api/growth-entries/:id',
            bodySchema,
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams

        const existing = await prisma.growthEntry.findUnique({ where: { id } })
        if (!existing) {
            return { status: 404, body: { error: 'Growth entry not found' } }
        }

        if (user.role !== 'SALES_MANAGER' && existing.ownerId !== user.id) {
            return { status: 403, body: { error: 'You can only edit your own growth entries' } }
        }

        const updated = await prisma.growthEntry.update({
            where: { id },
            data: {
                ...(req.request.body.label !== undefined && { label: req.request.body.label }),
                ...(req.request.body.year !== undefined && { year: req.request.body.year }),
                ...(req.request.body.quarter !== undefined && { quarter: req.request.body.quarter }),
                ...(req.request.body.revenue !== undefined && { revenue: new Prisma.Decimal(req.request.body.revenue) }),
                ...(req.request.body.notes !== undefined && { notes: req.request.body.notes }),
            },
            include: {
                owner: { select: { id: true, firstName: true, lastName: true } },
            },
        })

        return {
            status: 200,
            body: {
                ...updated,
                revenue: Number(updated.revenue),
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to update growth entry', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

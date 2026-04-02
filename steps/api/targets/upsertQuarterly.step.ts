import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const bodySchema = z.object({
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4),
    targets: z.array(z.object({
        id: z.string().optional(),
        bdId: z.string().uuid(),
        quota: z.number().min(0),
    })).min(1),
})

export const config = {
    name: 'UpsertQuarterlyTargets',
    description: 'Bulk create or update quarterly quota targets for active BDs',
    triggers: [
        { type: 'http', method: 'PUT', path: '/api/targets/quarterly' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can update quarterly targets' } }
        }

        const parsed = bodySchema.safeParse(req.request.body)
        if (!parsed.success) {
            return { status: 400, body: { error: 'Validation failed', details: parsed.error.flatten() } }
        }

        const { year, quarter, targets } = parsed.data
        const quarterMonth = (quarter - 1) * 3 + 1
        const activeReps = await prisma.bD.findMany({
            where: { isActive: true, role: 'BD_REP', id: { in: targets.map((target) => target.bdId) } },
            select: { id: true },
        })
        const allowedIds = new Set(activeReps.map((rep) => rep.id))
        if (allowedIds.size !== targets.length) {
            return { status: 400, body: { error: 'Targets can only be set for active BD reps' } }
        }

        const date = await prisma.dateDimension.findFirst({
            where: { year, quarter, month: quarterMonth, day: 1 },
            select: { id: true },
        })

        if (!date) {
            return { status: 404, body: { error: 'Date dimension row not found for selected quarter' } }
        }

        await prisma.$transaction(async (tx) => {
            for (const target of targets) {
                const existing = await tx.target.findFirst({
                    where: {
                        bdId: target.bdId,
                        periodType: 'QUARTERLY',
                        dateId: date.id,
                    },
                    select: { id: true },
                })

                if (existing) {
                    await tx.target.update({
                        where: { id: existing.id },
                        data: { quota: new Prisma.Decimal(target.quota) },
                    })
                } else {
                    await tx.target.create({
                        data: {
                            bdId: target.bdId,
                            dateId: date.id,
                            periodType: 'QUARTERLY',
                            quota: new Prisma.Decimal(target.quota),
                        },
                    })
                }
            }
        })

        const savedTargets = await prisma.target.findMany({
            where: {
                periodType: 'QUARTERLY',
                dateId: date.id,
            },
            include: {
                bd: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
        })

        return {
            status: 200,
            body: {
                year,
                quarter,
                targets: savedTargets.map((target) => ({
                    id: target.id,
                    bdId: target.bdId,
                    bdName: `${target.bd.firstName} ${target.bd.lastName}`,
                    role: target.bd.role,
                    quota: Number(target.quota),
                })),
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to upsert quarterly targets', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

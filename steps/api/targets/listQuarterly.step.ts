import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListQuarterlyTargets',
    description: 'List editable quarterly quota targets for all active BDs',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/targets/quarterly' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can view quarterly targets' } }
        }

        const year = Number(req.request.queryParams?.year)
        const quarter = Number(req.request.queryParams?.quarter)
        if (!year || !quarter || quarter < 1 || quarter > 4) {
            return { status: 400, body: { error: 'year and quarter are required' } }
        }

        const quarterMonth = (quarter - 1) * 3 + 1
        const date = await prisma.dateDimension.findFirst({
            where: { year, quarter, month: quarterMonth, day: 1 },
            select: { id: true },
        })

        if (!date) {
            return { status: 404, body: { error: 'Date dimension row not found for selected quarter' } }
        }

        const [bds, targets] = await Promise.all([
            prisma.bD.findMany({
                where: { isActive: true, role: 'BD_REP' },
                select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
                orderBy: [{ firstName: 'asc' }],
            }),
            prisma.target.findMany({
                where: {
                    periodType: 'QUARTERLY',
                    dateId: date.id,
                },
                select: { id: true, bdId: true, quota: true },
            }),
        ])

        const targetMap = new Map(targets.map((target) => [target.bdId, target]))
        return {
            status: 200,
            body: {
                year,
                quarter,
                targets: bds.map((bd) => {
                    const existing = targetMap.get(bd.id)
                    return {
                        id: existing?.id ?? null,
                        bdId: bd.id,
                        bdName: `${bd.firstName} ${bd.lastName}`,
                        role: bd.role,
                        quota: Number(existing?.quota ?? 0),
                    }
                }),
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list quarterly targets', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

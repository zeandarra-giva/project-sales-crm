import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'GetDealHistory',
    description: 'Get full stage transition history for a deal (FR-ADD-002)',
    triggers: [
        { type: 'http' as const, method: 'GET' as const, path: '/api/deals/:id/history' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams

        // Verify deal exists and user has access
        const deal = await prisma.deal.findUnique({
            where: { id },
            select: { id: true, bdId: true },
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only view your own deals' } }
        }

        const history = await prisma.dealAuditLog.findMany({
            where: { dealId: id },
            include: {
                stage: { select: { id: true, name: true } },
                changedBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { enteredAt: 'desc' },
        })

        const activities = await prisma.dealActivity.findMany({
            where: { dealId: id },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        // Compute daysInStage for each entry client-side (exitedAt null = still current)
        const stageEntries = history.map((entry) => {
            const exitTime = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now()
            const enterTime = new Date(entry.enteredAt).getTime()
            const daysInStage = Math.floor((exitTime - enterTime) / 86400000)

            return {
                id: entry.id,
                type: 'stage_change',
                title: entry.stage.name,
                stage: entry.stage.name,
                stageId: entry.stageId,
                enteredAt: entry.enteredAt,
                exitedAt: entry.exitedAt,
                daysInStage,
                isCurrent: entry.exitedAt === null,
                changedById: entry.changedById,
                changedBy: entry.changedBy,
                notes: entry.notes,
            }
        })

        const activityEntries = activities.map((entry) => ({
            id: entry.id,
            type: entry.type === 'CONTRACT_TERMINATED' ? 'contract_terminated' : 'stage_change',
            title: entry.title,
            enteredAt: entry.createdAt,
            effectiveDate: entry.effectiveDate,
            changedById: entry.createdById,
            changedBy: entry.createdBy,
            notes: entry.description,
            isCurrent: false,
        }))

        const enriched = [...stageEntries, ...activityEntries].sort(
            (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime()
        )

        return { status: 200, body: enriched }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to get deal history', { error: error.message, dealId: req.request.pathParams.id })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

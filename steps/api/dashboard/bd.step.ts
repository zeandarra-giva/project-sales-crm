import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'BDDashboard',
    description: 'Returns all 10 BD-level dashboard metrics for a given quarter/year',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/dashboard/bd' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const { queryParams } = req.request

        // Managers can view any BD's dashboard via ?bdId=
        const bdId =
            user.role === 'SALES_MANAGER' && queryParams?.bdId
                ? (queryParams.bdId as string)
                : user.id

        // Parse quarter/year from query params (default: current quarter)
        const now = new Date()
        const year = queryParams?.year
            ? parseInt(queryParams.year as string, 10)
            : now.getFullYear()
        const quarter = queryParams?.quarter
            ? parseInt(queryParams.quarter as string, 10)
            : Math.floor(now.getMonth() / 3) + 1

        // Quarter date range
        const qStart = new Date(year, (quarter - 1) * 3, 1)
        const qEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999)

        // ── 1. Closed Won stage ID ─────────────────────────────────────────
        const closedWonStage = await prisma.pipelineStage.findFirst({
            where: { name: 'Closed Won' },
        })
        if (!closedWonStage) {
            return { status: 500, body: { error: 'Closed Won stage not found' } }
        }

        // ── 2. Closed Won deals this quarter ──────────────────────────────
        const closedWonDeals = await prisma.deal.findMany({
            where: {
                bdId,
                stageId: closedWonStage.id,
                isClosed: true,
                closedDate: { gte: qStart, lte: qEnd },
            },
        })

        const dealsClosed = closedWonDeals.length
        const closedRevenue = closedWonDeals.reduce(
            (sum, d) => sum + Number(d.revenue ?? 0),
            0
        )

        // ── 3. Open pipeline deals ─────────────────────────────────────────
        const openDealsRaw = await prisma.deal.findMany({
            where: { bdId, isClosed: false },
            include: {
                stage: { select: { id: true, name: true } },
                client: { select: { id: true, name: true, accountType: true } },
            },
            orderBy: { startDate: 'asc' }, // oldest first = most stale
        })

        const openPipelineCount = openDealsRaw.length
        const openPipelineValue = openDealsRaw.reduce(
            (sum, d) => sum + Number(d.revenue ?? 0),
            0
        )

        // ── 4. Quarterly quota (from Target via DateDimension) ─────────────
        const targetRecord = await prisma.target.findFirst({
            where: {
                bdId,
                periodType: 'QUARTERLY',
                date: { year, quarter },
            },
        })
        const quarterlyTarget = Number(targetRecord?.quota ?? 0)

        // ── 5. Quota attainment ────────────────────────────────────────────
        const quotaAttainment =
            quarterlyTarget > 0
                ? Math.round((closedRevenue / quarterlyTarget) * 100 * 10) / 10
                : 0

        // ── 6. Weighted pipeline for forecast ─────────────────────────────
        const projections = await prisma.dealProjection.findMany({
            where: { bdId, deal: { isClosed: false } },
        })
        const weightedPipeline = projections.reduce(
            (sum, p) =>
                sum + Number(p.projectedAmount) * (Number(p.probabilityPct) / 100),
            0
        )
        const salesForecast = closedRevenue + weightedPipeline

        // ── 7. Sales variance (how far from quota) ────────────────────────
        const salesVariance = quarterlyTarget - closedRevenue

        // ── 8. Monthly excess/deficit ─────────────────────────────────────
        // Expected pace = quota / 3 months per quarter, scaled to days elapsed
        const monthsElapsed =
            (now.getFullYear() === year && Math.floor(now.getMonth() / 3) + 1 === quarter)
                ? now.getMonth() - (quarter - 1) * 3 + 1
                : 3
        const expectedByNow = quarterlyTarget > 0 ? (quarterlyTarget / 3) * monthsElapsed : 0
        const monthlyExcessDeficit = closedRevenue - expectedByNow

        // ── 9. Quarterly excess/deficit ───────────────────────────────────
        const quarterlyExcessDeficit = closedRevenue - quarterlyTarget

        // ── 10. Pipeline by stage (raw SQL GROUP BY) ──────────────────────
        const pipelineByStage = await prisma.$queryRaw<
            { stage: string; count: number; value: number }[]
        >`
            SELECT ps.name AS stage,
                   COUNT(d.id)::int AS count,
                   COALESCE(SUM(d.revenue), 0)::float AS value
            FROM deal d
            JOIN pipeline_stage ps ON d.stage_id = ps.id
            WHERE d.bd_id = ${bdId} AND d.is_closed = false
            GROUP BY ps.name
            ORDER BY ps.name
        `

        // ── 11. Open deals (sorted by staleness) ──────────────────────────
        const openDeals = openDealsRaw.map((d) => ({
            id: d.id,
            dealName: d.dealName,
            revenue: Number(d.revenue ?? 0),
            startDate: d.startDate?.toISOString() ?? null,
            stage: d.stage.name,
            client: {
                id: d.client.id,
                name: d.client.name,
                accountType: d.client.accountType,
            },
        }))

        return {
            status: 200,
            body: {
                quarter,
                year,
                bdId,
                metrics: {
                    dealsClosed,
                    closedRevenue,
                    openPipeline: {
                        count: openPipelineCount,
                        value: openPipelineValue,
                    },
                    quotaAttainment,
                    salesForecast,
                    salesVariance,
                    monthlyExcessDeficit,
                    quarterlyExcessDeficit,
                    pipelineByStage,
                    openDeals,
                },
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('BD dashboard failed', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

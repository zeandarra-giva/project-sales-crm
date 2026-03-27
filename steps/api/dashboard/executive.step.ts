import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ExecutiveDashboard',
    description: 'Returns all 9 executive-level dashboard metrics (Manager only)',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/dashboard/executive' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Forbidden: Manager access only' } }
        }

        const { queryParams } = req.request

        // Parse quarter/year from query params (default: current quarter)
        const now = new Date()
        const year = queryParams?.year
            ? parseInt(queryParams.year as string, 10)
            : now.getFullYear()
        const quarter = queryParams?.quarter
            ? parseInt(queryParams.quarter as string, 10)
            : Math.floor(now.getMonth() / 3) + 1

        const qStart = new Date(year, (quarter - 1) * 3, 1)
        const qEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999)

        // ── Closed Won stage ID ───────────────────────────────────────────
        const closedWonStage = await prisma.pipelineStage.findFirst({
            where: { name: 'Closed Won' },
        })
        if (!closedWonStage) {
            return { status: 500, body: { error: 'Closed Won stage not found' } }
        }

        // ── 1. Team actual (total closed revenue across all BDs) ──────────
        const closedWonDeals = await prisma.deal.findMany({
            where: {
                stageId: closedWonStage.id,
                isClosed: true,
                closedDate: { gte: qStart, lte: qEnd },
            },
        })
        const teamActual = closedWonDeals.reduce(
            (sum, d) => sum + Number(d.revenue ?? 0),
            0
        )

        // ── 2. Team quota (sum of all BD quarterly targets) ───────────────
        const allTargets = await prisma.target.findMany({
            where: {
                periodType: 'QUARTERLY',
                date: { year, quarter },
            },
        })
        const teamQuota = allTargets.reduce((sum, t) => sum + Number(t.quota), 0)

        // ── 3. Team forecast (actual + weighted open pipeline) ─────────────
        const allProjections = await prisma.dealProjection.findMany({
            where: { deal: { isClosed: false } },
        })
        const weightedPipeline = allProjections.reduce(
            (sum, p) =>
                sum + Number(p.projectedAmount) * (Number(p.probabilityPct) / 100),
            0
        )
        const teamForecast = teamActual + weightedPipeline

        // ── 4. Attainment ─────────────────────────────────────────────────
        const attainment =
            teamQuota > 0
                ? Math.round((teamActual / teamQuota) * 100 * 10) / 10
                : 0

        // ── 5. Pipeline by stage ──────────────────────────────────────────
        const pipelineByStage = await prisma.$queryRaw<
            { stage: string; count: number; value: number }[]
        >`
            SELECT ps.name AS stage,
                   COUNT(d.id)::int AS count,
                   COALESCE(SUM(d.revenue), 0)::float AS value
            FROM deal d
            JOIN pipeline_stage ps ON d.stage_id = ps.id
            WHERE d.is_closed = false
            GROUP BY ps.name
            ORDER BY ps.name
        `

        // ── 6. Stuck deals (in stage longer than duration threshold) ──────
        const stagesWithDuration = await prisma.pipelineStage.findMany({
            where: { duration: { not: null } },
        })
        const stuckDeals: {
            id: string
            dealName: string
            stage: string
            bdName: string
            daysStuck: number
        }[] = []

        for (const stage of stagesWithDuration) {
            const threshold = stage.duration! // days
            const cutoff = new Date(now.getTime() - threshold * 24 * 60 * 60 * 1000)

            const stuck = await prisma.deal.findMany({
                where: {
                    stageId: stage.id,
                    isClosed: false,
                    startDate: { lte: cutoff },
                },
                include: {
                    bd: { select: { firstName: true, lastName: true } },
                },
            })

            for (const d of stuck) {
                const daysStuck = d.startDate
                    ? Math.floor(
                          (now.getTime() - d.startDate.getTime()) / (1000 * 60 * 60 * 24)
                      )
                    : 0
                stuckDeals.push({
                    id: d.id,
                    dealName: d.dealName,
                    stage: stage.name,
                    bdName: `${d.bd.firstName} ${d.bd.lastName}`,
                    daysStuck,
                })
            }
        }

        // Sort by most stuck first
        stuckDeals.sort((a, b) => b.daysStuck - a.daysStuck)

        // ── 7. Leaderboard (revenue per BD, ranked) ────────────────────────
        const leaderboard = await prisma.$queryRaw<
            {
                bdId: string
                name: string
                closedRevenue: number
                dealCount: number
                quota: number
                attainment: number
            }[]
        >`
            SELECT b.id AS "bdId",
                   CONCAT(b.first_name, ' ', b.last_name) AS name,
                   COALESCE(SUM(d.revenue), 0)::float AS "closedRevenue",
                   COUNT(d.id)::int AS "dealCount",
                   COALESCE(t.quota, 0)::float AS quota,
                   CASE WHEN COALESCE(t.quota, 0) > 0
                        THEN (COALESCE(SUM(d.revenue), 0) / t.quota * 100)::float
                        ELSE 0
                   END AS attainment
            FROM bd b
            LEFT JOIN deal d
                ON d.bd_id = b.id
                AND d.stage_id = ${closedWonStage.id}
                AND d.closed_date >= ${qStart}
                AND d.closed_date <= ${qEnd}
            LEFT JOIN (
                SELECT t2.bd_id, t2.quota
                FROM target t2
                JOIN date_dimension dd ON dd.id = t2.date_id
                WHERE t2.period_type = 'QUARTERLY'
                  AND dd.year = ${year}
                  AND dd.quarter = ${quarter}
            ) t ON t.bd_id = b.id
            WHERE b.is_active = true
            GROUP BY b.id, b.first_name, b.last_name, t.quota
            ORDER BY "closedRevenue" DESC
        `

        // ── 8. Deals by account type ──────────────────────────────────────
        const dealsByAccountType = await prisma.$queryRaw<
            { accountType: string; count: number; revenue: number }[]
        >`
            SELECT c.account_type AS "accountType",
                   COUNT(d.id)::int AS count,
                   COALESCE(SUM(d.revenue), 0)::float AS revenue
            FROM deal d
            JOIN client c ON d.client_id = c.id
            WHERE d.stage_id = ${closedWonStage.id}
              AND d.closed_date >= ${qStart}
              AND d.closed_date <= ${qEnd}
            GROUP BY c.account_type
            ORDER BY revenue DESC
        `

        // ── 9. Service performance ─────────────────────────────────────────
        const servicePerformance = await prisma.$queryRaw<
            { service: string; dealCount: number; revenue: number }[]
        >`
            SELECT s.name AS service,
                   COUNT(d.id)::int AS "dealCount",
                   COALESCE(SUM(d.revenue), 0)::float AS revenue
            FROM deal d
            JOIN service s ON d.service_id = s.id
            WHERE d.stage_id = ${closedWonStage.id}
              AND d.closed_date >= ${qStart}
              AND d.closed_date <= ${qEnd}
            GROUP BY s.name
            ORDER BY revenue DESC
        `

        return {
            status: 200,
            body: {
                quarter,
                year,
                metrics: {
                    teamActual,
                    teamQuota,
                    teamForecast,
                    attainment,
                    pipelineByStage,
                    stuckDeals,
                    leaderboard,
                    dealsByAccountType,
                    servicePerformance,
                },
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Executive dashboard failed', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

import { type Handlers, type StepConfig, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListGrowthEntries',
    description: 'List growth table entries and a side-by-side comparison payload',
    triggers: [
        { type: 'http' as const, method: 'GET' as const, path: '/api/growth-entries' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

type ComparisonItem = {
    label: string
    leftRevenue: number
    rightRevenue: number
    delta: number
    growthPct: number | null
}

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)

        const params = req.request.queryParams ?? {}
        const parsedYear = params.year ? parseInt(params.year as string, 10) : undefined
        const parsedQuarter = params.quarter ? parseInt(params.quarter as string, 10) : undefined
        const parsedCompareYear = params.compareYear ? parseInt(params.compareYear as string, 10) : undefined
        const parsedCompareQuarter = params.compareQuarter ? parseInt(params.compareQuarter as string, 10) : undefined

        const year = Number.isFinite(parsedYear) ? parsedYear : undefined
        const quarter = Number.isFinite(parsedQuarter) ? parsedQuarter : undefined
        const compareYear = Number.isFinite(parsedCompareYear) ? parsedCompareYear : undefined
        const compareQuarter = Number.isFinite(parsedCompareQuarter) ? parsedCompareQuarter : undefined

        const where = {
            ...(user.role !== 'SALES_MANAGER' ? { ownerId: user.id } : {}),
            ...(year ? { year } : {}),
            ...(quarter ? { quarter } : {}),
        }

        const compareWhere = {
            ...(user.role !== 'SALES_MANAGER' ? { ownerId: user.id } : {}),
            ...(compareYear ? { year: compareYear } : {}),
            ...(compareQuarter ? { quarter: compareQuarter } : {}),
        }

        const [entries, comparisonEntries] = await Promise.all([
            prisma.growthEntry.findMany({
                where,
                include: {
                    owner: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: [{ year: 'desc' }, { quarter: 'desc' }, { label: 'asc' }],
            }),
            compareYear
                ? prisma.growthEntry.findMany({
                      where: compareWhere,
                      orderBy: [{ label: 'asc' }],
                  })
                : Promise.resolve([]),
        ])

        const leftMap = new Map<string, number>()
        for (const entry of entries) {
            leftMap.set(entry.label, (leftMap.get(entry.label) ?? 0) + Number(entry.revenue))
        }

        const rightMap = new Map<string, number>()
        for (const entry of comparisonEntries) {
            rightMap.set(entry.label, (rightMap.get(entry.label) ?? 0) + Number(entry.revenue))
        }

        const labels = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort()
        const comparison: ComparisonItem[] = labels.map((label) => {
            const leftRevenue = leftMap.get(label) ?? 0
            const rightRevenue = rightMap.get(label) ?? 0
            const delta = leftRevenue - rightRevenue
            const growthPct = rightRevenue === 0 ? null : (delta / rightRevenue) * 100
            return { label, leftRevenue, rightRevenue, delta, growthPct }
        })

        return {
            status: 200,
            body: {
                entries: entries.map((entry) => ({
                    id: entry.id,
                    label: entry.label,
                    year: entry.year,
                    quarter: entry.quarter,
                    revenue: Number(entry.revenue),
                    notes: entry.notes,
                    owner: entry.owner,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                })),
                comparison,
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list growth entries', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

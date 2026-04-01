import { type Handlers, type StepConfig, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

type ComparisonMode = 'year' | 'quarter'

type ComparisonSelection = {
    mode: ComparisonMode
    year: number
    quarter: number
    years: number[]
    quarters: number[]
}

type SnapshotItem = {
    name: string
    value: number
    deals: number
}

type LeadSourceItem = {
    source: string
    value: number
    deals: number
    wins: number
    losses: number
    winRate: number
}

type StageCycleItem = {
    stage: string
    avgDays: number
}

type Snapshot = {
    label: string
    periods: Array<{ year: number; quarter: number }>
    quota: number
    actual: number
    attainmentPct: number
    pipelineValue: number
    openDeals: number
    wins: number
    losses: number
    winRate: number
    avgSalesCycleDays: number | null
    longestCycleDays: number | null
    sampleSize: number
    lostDeals: number
    lostValue: number
    serviceRevenue: SnapshotItem[]
    accountRevenue: SnapshotItem[]
    leadSourcePerformance: LeadSourceItem[]
    stageCycle: StageCycleItem[]
}

type StageAccumulator = {
    totalDays: number
    count: number
}

export const config = {
    name: 'GrowthComparisonReport',
    description: 'Returns side-by-side growth comparison analytics for reporting',
    triggers: [
        { type: 'http' as const, method: 'GET' as const, path: '/api/reporting/growth-comparison' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

function parseInteger(value: unknown, fallback: number) {
    const parsed = parseInt(String(value ?? ''), 10)
    return Number.isFinite(parsed) ? parsed : fallback
}

function parseNumberList(value: unknown) {
    if (!value) return [] as number[]

    return String(value)
        .split(',')
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => Number.isFinite(item))
}

function dedupeSorted(values: number[]) {
    return Array.from(new Set(values)).sort((a, b) => a - b)
}

function buildSelection(prefix: 'left' | 'right', params: Record<string, unknown>, defaults: { year: number; quarter: number }) {
    const mode = params[`${prefix}Mode`] === 'quarter' ? 'quarter' : 'year'
    return {
        mode,
        year: parseInteger(params[`${prefix}Year`], defaults.year),
        quarter: parseInteger(params[`${prefix}Quarter`], defaults.quarter),
        years: dedupeSorted(parseNumberList(params[`${prefix}Years`])),
        quarters: dedupeSorted(parseNumberList(params[`${prefix}Quarters`])),
    } satisfies ComparisonSelection
}

function buildPeriods(selection: ComparisonSelection) {
    if (selection.mode === 'year') {
        const quarters = selection.quarters.length > 0 ? selection.quarters : [1, 2, 3, 4]
        return quarters.map((quarter) => ({ year: selection.year, quarter }))
    }

    const years = selection.years.length > 0 ? selection.years : [selection.year]
    return years.map((year) => ({ year, quarter: selection.quarter }))
}

function buildLabel(selection: ComparisonSelection) {
    if (selection.mode === 'year') {
        if (selection.quarters.length === 0 || selection.quarters.length === 4) {
            return `${selection.year} · All Quarters`
        }

        return `${selection.year} · ${selection.quarters.map((quarter) => `Q${quarter}`).join(', ')}`
    }

    const years = selection.years.length > 0 ? selection.years : [selection.year]
    return `Q${selection.quarter} · ${years.join(', ')}`
}

function quarterBounds(year: number, quarter: number) {
    const start = new Date(year, (quarter - 1) * 3, 1)
    const end = new Date(year, quarter * 3, 0, 23, 59, 59, 999)
    return { start, end }
}

function sortByValueDesc<T extends { value: number }>(items: T[]) {
    return items.sort((a, b) => b.value - a.value)
}

async function buildSnapshot(selection: ComparisonSelection, scopedBdId?: string | null): Promise<Snapshot> {
    const periods = buildPeriods(selection)
    const label = buildLabel(selection)

    const [closedWonStage, closedLostStage] = await Promise.all([
        prisma.pipelineStage.findFirst({ where: { name: 'Closed Won' }, select: { id: true } }),
        prisma.pipelineStage.findFirst({ where: { name: 'Closed Lost' }, select: { id: true } }),
    ])

    if (!closedWonStage || !closedLostStage) {
        throw new Error('Required pipeline stages were not found')
    }

    const serviceRevenue = new Map<string, SnapshotItem>()
    const accountRevenue = new Map<string, SnapshotItem>()
    const leadSourcePerformance = new Map<string, LeadSourceItem>()
    const stageCycle = new Map<string, StageAccumulator>()

    let quota = 0
    let actual = 0
    let pipelineValue = 0
    let openDeals = 0
    let wins = 0
    let losses = 0
    let weightedCycleDays = 0
    let sampleSize = 0
    let longestCycleDays: number | null = null
    let lostDeals = 0
    let lostValue = 0

    for (const period of periods) {
        const { start, end } = quarterBounds(period.year, period.quarter)

        const [periodTargets, closedWonDeals, closedLostDeals, openPipelineDeals, cycleDeals, auditLogs] = await Promise.all([
            prisma.target.findMany({
                where: {
                    periodType: 'QUARTERLY',
                    date: { year: period.year, quarter: period.quarter },
                    ...(scopedBdId ? { bdId: scopedBdId } : {}),
                },
                select: { quota: true },
            }),
            prisma.deal.findMany({
                where: {
                    stageId: closedWonStage.id,
                    isClosed: true,
                    closedDate: { gte: start, lte: end },
                    ...(scopedBdId ? { bdId: scopedBdId } : {}),
                },
                include: {
                    client: { select: { accountType: true } },
                    service: { select: { name: true } },
                    bundle: { select: { name: true } },
                },
            }),
            prisma.deal.findMany({
                where: {
                    stageId: closedLostStage.id,
                    isClosed: true,
                    closedDate: { gte: start, lte: end },
                    ...(scopedBdId ? { bdId: scopedBdId } : {}),
                },
                select: {
                    finalProposedValue: true,
                    revenue: true,
                    leadSource: true,
                },
            }),
            prisma.deal.findMany({
                where: {
                    startDate: { lte: end },
                    OR: [
                        { closedDate: null },
                        { closedDate: { gt: end } },
                    ],
                    ...(scopedBdId ? { bdId: scopedBdId } : {}),
                },
                select: { revenue: true },
            }),
            prisma.deal.findMany({
                where: {
                    isClosed: true,
                    closedDate: { gte: start, lte: end },
                    salesCycleDays: { not: null },
                    ...(scopedBdId ? { bdId: scopedBdId } : {}),
                },
                select: { salesCycleDays: true },
            }),
            prisma.dealAuditLog.findMany({
                where: {
                    exitedAt: { gte: start, lte: end },
                    daysInStage: { not: null },
                    deal: scopedBdId ? { bdId: scopedBdId } : undefined,
                },
                include: {
                    stage: { select: { name: true } },
                },
            }),
        ])

        quota += periodTargets.reduce((sum, item) => sum + Number(item.quota), 0)
        actual += closedWonDeals.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0)
        pipelineValue += openPipelineDeals.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0)
        openDeals += openPipelineDeals.length
        wins += closedWonDeals.length
        losses += closedLostDeals.length
        lostDeals += closedLostDeals.length
        lostValue += closedLostDeals.reduce((sum, item) => sum + Number(item.finalProposedValue ?? item.revenue ?? 0), 0)

        for (const item of closedWonDeals) {
            const serviceName = item.service?.name || item.bundle?.name || 'Unassigned'
            const existingService = serviceRevenue.get(serviceName) || { name: serviceName, value: 0, deals: 0 }
            existingService.value += Number(item.revenue ?? 0)
            existingService.deals += 1
            serviceRevenue.set(serviceName, existingService)

            const accountType = item.client.accountType || 'Unassigned'
            const existingAccount = accountRevenue.get(accountType) || { name: accountType, value: 0, deals: 0 }
            existingAccount.value += Number(item.revenue ?? 0)
            existingAccount.deals += 1
            accountRevenue.set(accountType, existingAccount)

            const sourceKey = item.leadSource || 'UNKNOWN'
            const existingSource = leadSourcePerformance.get(sourceKey) || {
                source: sourceKey,
                value: 0,
                deals: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
            }
            existingSource.value += Number(item.revenue ?? 0)
            existingSource.deals += 1
            existingSource.wins += 1
            leadSourcePerformance.set(sourceKey, existingSource)
        }

        for (const item of closedLostDeals) {
            const sourceKey = item.leadSource || 'UNKNOWN'
            const existingSource = leadSourcePerformance.get(sourceKey) || {
                source: sourceKey,
                value: 0,
                deals: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
            }
            existingSource.deals += 1
            existingSource.losses += 1
            leadSourcePerformance.set(sourceKey, existingSource)
        }

        sampleSize += cycleDeals.length
        weightedCycleDays += cycleDeals.reduce((sum, item) => sum + Number(item.salesCycleDays ?? 0), 0)
        for (const item of cycleDeals) {
            const days = Number(item.salesCycleDays ?? 0)
            longestCycleDays = longestCycleDays === null ? days : Math.max(longestCycleDays, days)
        }

        for (const item of auditLogs) {
            const stageName = item.stage.name || 'Unknown'
            const existing = stageCycle.get(stageName) || { totalDays: 0, count: 0 }
            existing.totalDays += Number(item.daysInStage ?? 0)
            existing.count += 1
            stageCycle.set(stageName, existing)
        }
    }

    const finalLeadSource = Array.from(leadSourcePerformance.values()).map((item) => ({
        ...item,
        winRate: item.wins + item.losses > 0 ? (item.wins / (item.wins + item.losses)) * 100 : 0,
    }))

    const finalStageCycle = Array.from(stageCycle.entries()).map(([stage, values]) => ({
        stage,
        avgDays: values.count > 0 ? values.totalDays / values.count : 0,
    }))

    return {
        label,
        periods,
        quota,
        actual,
        attainmentPct: quota > 0 ? (actual / quota) * 100 : 0,
        pipelineValue,
        openDeals,
        wins,
        losses,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        avgSalesCycleDays: sampleSize > 0 ? weightedCycleDays / sampleSize : null,
        longestCycleDays,
        sampleSize,
        lostDeals,
        lostValue,
        serviceRevenue: sortByValueDesc(Array.from(serviceRevenue.values())).slice(0, 6),
        accountRevenue: sortByValueDesc(Array.from(accountRevenue.values())).slice(0, 6),
        leadSourcePerformance: sortByValueDesc(finalLeadSource).slice(0, 6),
        stageCycle: finalStageCycle.sort((a, b) => b.avgDays - a.avgDays),
    }
}

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        const params = (req.request.queryParams ?? {}) as Record<string, unknown>

        const now = new Date()
        const defaults = {
            year: now.getFullYear(),
            quarter: Math.floor(now.getMonth() / 3) + 1,
        }

        const requestedBdId = params.bdId ? String(params.bdId) : null
        const scopedBdId = user.role === 'SALES_MANAGER' ? requestedBdId : user.id

        const left = buildSelection('left', params, defaults)
        const right = buildSelection('right', params, {
            year: defaults.year - 1,
            quarter: defaults.quarter,
        })

        const [leftSnapshot, rightSnapshot] = await Promise.all([
            buildSnapshot(left, scopedBdId),
            buildSnapshot(right, scopedBdId),
        ])

        return {
            status: 200,
            body: {
                left: leftSnapshot,
                right: rightSnapshot,
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }

        logger.error('Failed to build growth comparison report', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

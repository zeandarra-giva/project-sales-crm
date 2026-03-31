import { type Handlers, type StepConfig, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'GetReportingPeriods',
    description: 'List available reporting years from deals and growth table entries',
    triggers: [
        { type: 'http' as const, method: 'GET' as const, path: '/api/reporting/periods' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        await authenticate(req.request)

        const now = new Date()
        const currentYear = now.getFullYear()

        const [growthEntries, deals] = await Promise.all([
            prisma.growthEntry.findMany({
                select: { year: true },
                distinct: ['year'],
                orderBy: { year: 'desc' },
            }),
            prisma.deal.findMany({
                select: { startDate: true, closedDate: true },
            }),
        ])

        const years = new Set<number>([currentYear])

        for (const entry of growthEntries) {
            years.add(entry.year)
        }

        for (const deal of deals) {
            if (deal.startDate) years.add(deal.startDate.getFullYear())
            if (deal.closedDate) years.add(deal.closedDate.getFullYear())
        }

        return {
            status: 200,
            body: {
                currentYear,
                years: Array.from(years).sort((a, b) => b - a),
                quarters: [1, 2, 3, 4],
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to fetch reporting periods', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}

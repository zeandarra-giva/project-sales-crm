import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // 1. Pipeline Stages (PRD Section 12.6.1)
    const stages = [
        { name: 'Inquiry', duration: 3 },
        { name: 'Prospecting', duration: 3 },
        { name: 'Discovery', duration: 3 },
        { name: 'Proposal Sent', duration: 3 },
        { name: 'Negotiation', duration: 3 },
        { name: 'Closed Won', duration: null },
        { name: 'Closed Lost', duration: null },
    ]

    for (const stage of stages) {
        await prisma.pipelineStage.upsert({
            where: { name: stage.name },
            update: {},
            create: stage,
        })
    }
    console.log('Pipeline stages seeded')

    // 2. Industries (PRD Section 6.9 - 13 categories)
    const industries = [
        'Technology & IT',
        'Financial Services',
        'Healthcare & Pharmaceuticals',
        'Retail & E-commerce',
        'Manufacturing',
        'Telecommunications',
        'Media & Entertainment',
        'Professional Services',
        'Government & Public Sector',
        'Education',
        'Real Estate',
        'Hospitality & Tourism',
        'Other',
    ]

    for (const name of industries) {
        await prisma.industry.upsert({
            where: { name },
            update: {},
            create: { name },
        })
    }
    console.log('Industries seeded')

    // 3. Services (PRD Section 6.3)
    const services = [
        { name: 'LOCOBUZZ', description: 'Social media management', isActive: true },
        { name: 'MEDIAWATCH', description: 'Media monitoring', isActive: true },
        { name: 'SHAREDVIEW', description: 'Shared analytics', isActive: true },
        { name: 'REPORTS', description: 'Custom reporting', isActive: true },
    ]

    for (const svc of services) {
        await prisma.service.upsert({
            where: { name: svc.name },
            update: {},
            create: svc,
        })
    }
    console.log('Services seeded')

    // 4. BD Members (PRD Section 5)
    const password = await bcrypt.hash('changeme123', 10)

    const bdMembers = [
        { firstName: 'Henne', lastName: 'Unknown', email: 'henne@company.com', role: 'BD_REP' as const },
        { firstName: 'Isten', lastName: 'Unknown', email: 'isten@company.com', role: 'BD_REP' as const },
        { firstName: 'Brian', lastName: 'Unknown', email: 'brian@company.com', role: 'BD_REP' as const },
        { firstName: 'Manager', lastName: 'Unknown', email: 'manager@company.com', role: 'SALES_MANAGER' as const },
    ]

    for (const bd of bdMembers) {
        await prisma.bD.upsert({
            where: { email: bd.email },
            update: {},
            create: { ...bd, password },
        })
    }
    console.log('BD members seeded')

    // 5. Date Dimension — Q1-Q4 2026 (monthly granularity)
    const months2026 = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(2026, i, 1)
        return {
            id: `dd-2026-${String(i + 1).padStart(2, '0')}`,
            timestamp: date,
            year: 2026,
            month: i + 1,
            monthNumber: i + 1,
            day: 1,
            dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
            quarter: Math.ceil((i + 1) / 3),
            isQuarterEnd: [2, 5, 8, 11].includes(i), // Mar, Jun, Sep, Dec
        }
    })

    for (const m of months2026) {
        await prisma.dateDimension.upsert({
            where: { id: m.id },
            update: {},
            create: m,
        })
    }
    console.log('Date dimensions seeded (12 months of 2026)')

    // 6. Targets — Quarterly + Monthly for each BD Rep
    const bdReps = await prisma.bD.findMany({ where: { role: 'BD_REP' } })
    const QUARTERLY_QUOTA = 1750000  // ₱1,750,000 per BD rep per quarter
    const MONTHLY_QUOTA = 583333     // ₱583,333 per BD rep per month (~quarterly / 3)

    for (const bd of bdReps) {
        // Quarterly targets: Q1 (Jan), Q2 (Apr), Q3 (Jul), Q4 (Oct)
        const quarterStartMonths = [1, 4, 7, 10]
        for (let q = 0; q < 4; q++) {
            const dateId = `dd-2026-${String(quarterStartMonths[q]).padStart(2, '0')}`
            await prisma.target.upsert({
                where: { id: `target-${bd.id}-Q${q + 1}-2026` },
                update: {},
                create: {
                    id: `target-${bd.id}-Q${q + 1}-2026`,
                    quota: QUARTERLY_QUOTA,
                    periodType: 'QUARTERLY',
                    dateId,
                    bdId: bd.id,
                },
            })
        }

        // Monthly targets: Jan–Dec
        for (let m = 1; m <= 12; m++) {
            const dateId = `dd-2026-${String(m).padStart(2, '0')}`
            await prisma.target.upsert({
                where: { id: `target-${bd.id}-M${m}-2026` },
                update: {},
                create: {
                    id: `target-${bd.id}-M${m}-2026`,
                    quota: MONTHLY_QUOTA,
                    periodType: 'MONTHLY',
                    dateId,
                    bdId: bd.id,
                },
            })
        }
    }
    console.log(`Targets seeded (${bdReps.length} BD reps × 16 targets each = ${bdReps.length * 16} rows)`)

    console.log('Seeding complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
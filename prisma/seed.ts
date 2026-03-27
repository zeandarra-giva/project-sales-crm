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

    // ── 7. Sample Clients ─────────────────────────────────────────────────────
    const sampleClients = [
        { id: 'client-acme',    name: 'Acme Corporation',        accountType: 'ENTERPRISE' as const, status: 'ACTIVE' as const },
        { id: 'client-metro',   name: 'Metro Corp',              accountType: 'CORPORATE'  as const, status: 'ACTIVE' as const },
        { id: 'client-techst',  name: 'TechStart Inc',           accountType: 'SMB'        as const, status: 'ACTIVE' as const },
        { id: 'client-govph',   name: 'Metro Government Dept',   accountType: 'GOVERNMENT' as const, status: 'ACTIVE' as const },
        { id: 'client-digital', name: 'Digital Agency PH',       accountType: 'SMB'        as const, status: 'ACTIVE' as const },
        { id: 'client-bigbr',   name: 'BigBrand Holdings',       accountType: 'CORPORATE'  as const, status: 'ACTIVE' as const },
        { id: 'client-fintech', name: 'FinTech Solutions',       accountType: 'ENTERPRISE' as const, status: 'ACTIVE' as const },
        { id: 'client-retail',  name: 'RetailChain PH',          accountType: 'CORPORATE'  as const, status: 'ACTIVE' as const },
    ]

    for (const client of sampleClients) {
        await prisma.client.upsert({
            where: { id: client.id },
            update: {},
            create: client,
        })
    }
    console.log(`Sample clients seeded (${sampleClients.length})`)

    // ── 8. Sample Deals & Projections ─────────────────────────────────────────
    // Look up stages and services we need
    const stageMap = Object.fromEntries(
        (await prisma.pipelineStage.findMany()).map((s) => [s.name, s])
    )
    const serviceMap = Object.fromEntries(
        (await prisma.service.findMany()).map((s) => [s.name, s])
    )
    const bdMap = Object.fromEntries(
        bdReps.map((bd) => [bd.email, bd])
    )

    // Q1 2026 closed dates (spread across Jan–Mar)
    const q1Dates = [
        new Date('2026-01-15'),
        new Date('2026-02-10'),
        new Date('2026-02-28'),
        new Date('2026-03-12'),
        new Date('2026-03-20'),
    ]

    type DealSeed = {
        id: string
        dealName: string
        stageKey: string
        clientId: string
        bdEmail: string
        serviceKey: string
        monthlySubscription: number
        duration: number
        leadSource: 'INBOUND' | 'OUTBOUND' | 'REFERRAL'
        closedDate?: Date
        startDate: Date
        isClosed: boolean
        remarks?: string
        // Projection (open deals only)
        projection?: { probabilityPct: number; projectedAmount: number }
    }

    const deals: DealSeed[] = [
        // ── Henne: 2 Closed Won + 3 Open ──────────────────────────────────
        {
            id: 'deal-henne-cw1', dealName: 'Acme – Locobuzz Enterprise',
            stageKey: 'Closed Won', clientId: 'client-acme', bdEmail: 'henne@company.com',
            serviceKey: 'LOCOBUZZ', monthlySubscription: 50000, duration: 24,
            leadSource: 'INBOUND', isClosed: true,
            startDate: new Date('2025-10-01'), closedDate: q1Dates[0],
        },
        {
            id: 'deal-henne-cw2', dealName: 'Metro Corp – Mediawatch Annual',
            stageKey: 'Closed Won', clientId: 'client-metro', bdEmail: 'henne@company.com',
            serviceKey: 'MEDIAWATCH', monthlySubscription: 30000, duration: 12,
            leadSource: 'REFERRAL', isClosed: true,
            startDate: new Date('2025-11-15'), closedDate: q1Dates[1],
        },
        {
            id: 'deal-henne-op1', dealName: 'FinTech – SharedView Rollout',
            stageKey: 'Negotiation', clientId: 'client-fintech', bdEmail: 'henne@company.com',
            serviceKey: 'SHAREDVIEW', monthlySubscription: 45000, duration: 24,
            leadSource: 'OUTBOUND', isClosed: false,
            startDate: new Date('2026-01-20'),
            projection: { probabilityPct: 75, projectedAmount: 1080000 },
        },
        {
            id: 'deal-henne-op2', dealName: 'BigBrand – Reports Package',
            stageKey: 'Proposal Sent', clientId: 'client-bigbr', bdEmail: 'henne@company.com',
            serviceKey: 'REPORTS', monthlySubscription: 20000, duration: 12,
            leadSource: 'INBOUND', isClosed: false,
            startDate: new Date('2026-02-05'),
            projection: { probabilityPct: 50, projectedAmount: 240000 },
        },
        {
            id: 'deal-henne-op3', dealName: 'TechStart – Locobuzz SMB',
            stageKey: 'Prospecting', clientId: 'client-techst', bdEmail: 'henne@company.com',
            serviceKey: 'LOCOBUZZ', monthlySubscription: 12000, duration: 12,
            leadSource: 'OUTBOUND', isClosed: false,
            startDate: new Date('2026-02-20'),
            projection: { probabilityPct: 25, projectedAmount: 144000 },
        },

        // ── Isten: 2 Closed Won + 3 Open ──────────────────────────────────
        {
            id: 'deal-isten-cw1', dealName: 'Government Dept – Mediawatch Contract',
            stageKey: 'Closed Won', clientId: 'client-govph', bdEmail: 'isten@company.com',
            serviceKey: 'MEDIAWATCH', monthlySubscription: 55000, duration: 24,
            leadSource: 'OUTBOUND', isClosed: true,
            startDate: new Date('2025-09-01'), closedDate: q1Dates[2],
        },
        {
            id: 'deal-isten-cw2', dealName: 'RetailChain – Reports Suite',
            stageKey: 'Closed Won', clientId: 'client-retail', bdEmail: 'isten@company.com',
            serviceKey: 'REPORTS', monthlySubscription: 25000, duration: 12,
            leadSource: 'INBOUND', isClosed: true,
            startDate: new Date('2025-12-01'), closedDate: q1Dates[3],
        },
        {
            id: 'deal-isten-op1', dealName: 'Acme – SharedView Expansion',
            stageKey: 'Negotiation', clientId: 'client-acme', bdEmail: 'isten@company.com',
            serviceKey: 'SHAREDVIEW', monthlySubscription: 40000, duration: 12,
            leadSource: 'REFERRAL', isClosed: false,
            startDate: new Date('2026-01-10'),
            projection: { probabilityPct: 80, projectedAmount: 480000 },
        },
        {
            id: 'deal-isten-op2', dealName: 'Digital Agency – Locobuzz Pro',
            stageKey: 'Discovery', clientId: 'client-digital', bdEmail: 'isten@company.com',
            serviceKey: 'LOCOBUZZ', monthlySubscription: 18000, duration: 12,
            leadSource: 'INBOUND', isClosed: false,
            startDate: new Date('2026-02-15'),
            projection: { probabilityPct: 40, projectedAmount: 216000 },
        },
        {
            id: 'deal-isten-op3', dealName: 'FinTech – Mediawatch Pilot',
            stageKey: 'Proposal Sent', clientId: 'client-fintech', bdEmail: 'isten@company.com',
            serviceKey: 'MEDIAWATCH', monthlySubscription: 22000, duration: 12,
            leadSource: 'OUTBOUND', isClosed: false,
            startDate: new Date('2026-03-01'),
            projection: { probabilityPct: 55, projectedAmount: 264000 },
        },

        // ── Brian: 1 Closed Won + 4 Open (lower attainment, for variance) ──
        {
            id: 'deal-brian-cw1', dealName: 'Metro Corp – Reports Annual',
            stageKey: 'Closed Won', clientId: 'client-metro', bdEmail: 'brian@company.com',
            serviceKey: 'REPORTS', monthlySubscription: 35000, duration: 24,
            leadSource: 'REFERRAL', isClosed: true,
            startDate: new Date('2025-11-01'), closedDate: q1Dates[4],
        },
        {
            id: 'deal-brian-op1', dealName: 'BigBrand – Locobuzz Enterprise',
            stageKey: 'Negotiation', clientId: 'client-bigbr', bdEmail: 'brian@company.com',
            serviceKey: 'LOCOBUZZ', monthlySubscription: 48000, duration: 24,
            leadSource: 'OUTBOUND', isClosed: false,
            startDate: new Date('2026-01-05'),
            projection: { probabilityPct: 70, projectedAmount: 1152000 },
        },
        {
            id: 'deal-brian-op2', dealName: 'Government – SharedView Tender',
            stageKey: 'Proposal Sent', clientId: 'client-govph', bdEmail: 'brian@company.com',
            serviceKey: 'SHAREDVIEW', monthlySubscription: 60000, duration: 12,
            leadSource: 'OUTBOUND', isClosed: false,
            startDate: new Date('2026-01-25'),
            projection: { probabilityPct: 45, projectedAmount: 720000 },
        },
        {
            id: 'deal-brian-op3', dealName: 'TechStart – Reports Starter',
            stageKey: 'Discovery', clientId: 'client-techst', bdEmail: 'brian@company.com',
            serviceKey: 'REPORTS', monthlySubscription: 10000, duration: 12,
            leadSource: 'INBOUND', isClosed: false,
            startDate: new Date('2026-02-10'),
            projection: { probabilityPct: 35, projectedAmount: 120000 },
        },
        {
            id: 'deal-brian-op4', dealName: 'Digital Agency – Mediawatch',
            stageKey: 'Prospecting', clientId: 'client-digital', bdEmail: 'brian@company.com',
            serviceKey: 'MEDIAWATCH', monthlySubscription: 15000, duration: 12,
            leadSource: 'INBOUND', isClosed: false,
            startDate: new Date('2026-03-10'),
            projection: { probabilityPct: 20, projectedAmount: 180000 },
        },
    ]

    for (const d of deals) {
        const stage = stageMap[d.stageKey]
        const service = serviceMap[d.serviceKey]
        const bd = bdMap[d.bdEmail]
        if (!stage || !service || !bd) {
            console.warn(`Skipping deal ${d.id}: missing stage/service/bd`)
            continue
        }

        const revenue = d.monthlySubscription * d.duration

        await prisma.deal.upsert({
            where: { id: d.id },
            update: {},
            create: {
                id: d.id,
                dealName: d.dealName,
                stageId: stage.id,
                bdId: bd.id,
                clientId: d.clientId,
                serviceId: service.id,
                monthlySubscription: d.monthlySubscription,
                revenue,
                duration: d.duration,
                leadSource: d.leadSource,
                isClosed: d.isClosed,
                startDate: d.startDate,
                closedDate: d.closedDate ?? null,
                lastStageUpdateAt: d.startDate,
                remarks: d.isClosed ? 'Closed and signed.' : 'In progress.',
            },
        })

        // Seed DealProjection for open deals
        if (d.projection) {
            const { probabilityPct, projectedAmount } = d.projection
            const weightedValue = projectedAmount * (probabilityPct / 100)
            await prisma.dealProjection.upsert({
                where: { id: `proj-${d.id}` },
                update: {},
                create: {
                    id: `proj-${d.id}`,
                    dealId: d.id,
                    bdId: bd.id,
                    projectedAmount,
                    probabilityPct,
                    weightedValue,
                },
            })
        }
    }
    console.log(`Sample deals seeded (${deals.length}) + projections for open deals`)

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
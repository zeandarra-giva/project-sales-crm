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
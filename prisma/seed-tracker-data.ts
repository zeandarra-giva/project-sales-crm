import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const JSON_PATH = '/Users/markavale/Downloads/BD_Sales_Tracker_2026.json'

// ── Mappings ──────────────────────────────────────────────────────────────────

// Step 2: Map JSON probabilities to PRD's 7 stages only
const PROBABILITY_TO_STAGE: Record<string, string> = {
  'Prospecting (10%)': 'Prospecting',
  'Qualification (20%)': 'Prospecting',     // PRD has no "Qualification" — closest is Prospecting (20%)
  'Needs Analysis (40%)': 'Discovery',      // PRD has no "Needs Analysis" — closest is Discovery (40%)
  'Proposal Sent (60%)': 'Proposal Sent',
  'Negotiation (80%)': 'Negotiation',
  'Closed won (100%)': 'Closed Won',
  'Closed Lost (0%)': 'Closed Lost',
}

const LEAD_SOURCE_MAP: Record<string, 'INBOUND' | 'OUTBOUND' | 'REFERRAL'> = {
  'Inbound': 'INBOUND',
  'Outbound': 'OUTBOUND',
  'Referral': 'REFERRAL',
}

const CLIENT_TYPE_MAP: Record<string, 'ENTERPRISE' | 'CORPORATE' | 'SMB' | 'GOVERNMENT'> = {
  'ENTERPRISE': 'ENTERPRISE',
  'GOVERNMENT': 'GOVERNMENT',
  'AGENCY': 'SMB',
}

const SERVICE_NAME_MAP: Record<string, string> = {
  'LOCOBUZZ': 'LOCOBUZZ',
  'MEDIAWATCH': 'MEDIAWATCH',
  'SHAREDVIEW': 'SHAREDVIEW',
  'ADWATCH': 'ADWATCH',
  'REPORT': 'REPORT',
  'REPORT (EXCEL)': 'REPORT (EXCEL)',
  'LOCOBUZZ REPORT': 'LOCOBUZZ REPORT',
}

const BD_EMAIL_MAP: Record<string, string> = {
  'HENNE': 'henne@company.com',
  'ISTEN': 'isten@company.com',
  'BRIAN': 'brian@company.com',
}

// Step 5: Normalize JSON industry names to PRD's 13 categories
const INDUSTRY_NAME_MAP: Record<string, string> = {
  'Corporate & Professional Services': 'Professional Services',
  'Technology & Telecommunications': 'Technology & IT',
  'Consumer Goods & Retail': 'Retail & E-commerce',
  'Media & Communications': 'Media & Entertainment',
  'Real Estate & Property': 'Real Estate',
  'Non-Profit & Advocacy': 'Other',
  'Automotive': 'Manufacturing',
  'Manufacturing & Industrial': 'Manufacturing',
  'Energy & Utilities': 'Other',
}

// Stage probability mapping per PRD pipeline definitions
const STAGE_PROBABILITY: Record<string, number> = {
  'Inquiry': 10,
  'Prospecting': 20,
  'Discovery': 40,
  'Proposal Sent': 60,
  'Negotiation': 80,
  'Closed Won': 100,
  'Closed Lost': 0,
}

type DealRow = {
  row_number: number | null
  year: number | null
  month: string | null
  bd: string
  lead_source: string | null
  referred_by: string | null
  client: string
  brand: string | null
  industry: string | null
  client_type: string | null
  service: string | null
  monthly_subscription: number | null
  mmi_revenue: number | null
  duration_months: number | null
  start_date: string | null
  due_date: string | null
  probability: string | null
  status: string | null
  remarks: string | null
  action_plan: string | null
  initial_meeting_date: string | null
  initial_proposal_sent_date: string | null
  proposal_revisions: number | null
  contract_closed_date: string | null
  sales_cycle: number | null
  proposal_links: string | null
  contract_links: string | null
  revenue_breakdown?: Record<string, number | null>
  contact: {
    full_name: string | null
    designation: string | null
    email: string | null
    phone: string | null
  } | null
}

/** Extract clean email from potentially malformed strings like '"Name" <email@x.com>' */
function cleanEmail(raw: string | null): string | null {
  if (!raw) return null
  const match = String(raw).match(/<(.+?)>/)
  if (match) return match[1].trim().toLowerCase()
  return String(raw).trim().toLowerCase()
}

async function main() {
  console.log('Loading tracker data from JSON...')
  const raw = readFileSync(JSON_PATH, 'utf-8')
  const data = JSON.parse(raw)

  // ── 1. Clear existing deal-related data ───────────────────────────────────
  console.log('Clearing existing data...')
  await prisma.dealProjection.deleteMany()
  await prisma.dealSnapshot.deleteMany()
  await prisma.dealContact.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.dealAuditLog.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.client.deleteMany()
  await prisma.forecastSnapshot.deleteMany()
  await prisma.target.deleteMany()
  await prisma.growthEntry.deleteMany()
  // Clean up non-PRD stages if they exist
  await prisma.pipelineStage.deleteMany({ where: { name: { in: ['Qualification', 'Needs Analysis'] } } })
  // Clean up non-PRD industries (keep only the 13 defined in PRD)
  const prdIndustryNames = [
    'Technology & IT', 'Financial Services', 'Healthcare & Pharmaceuticals',
    'Retail & E-commerce', 'Manufacturing', 'Telecommunications',
    'Media & Entertainment', 'Professional Services', 'Government & Public Sector',
    'Education', 'Real Estate', 'Hospitality & Tourism', 'Other',
  ]
  await prisma.industry.deleteMany({ where: { name: { notIn: prdIndustryNames } } })
  console.log('Existing data cleared')

  // ── 2. Pipeline stages — PRD's 7 stages only ─────────────────────────────
  const allStages = [
    { name: 'Inquiry', duration: 3 },
    { name: 'Prospecting', duration: 3 },
    { name: 'Discovery', duration: 3 },
    { name: 'Proposal Sent', duration: 3 },
    { name: 'Negotiation', duration: 3 },
    { name: 'Closed Won', duration: null },
    { name: 'Closed Lost', duration: null },
  ]

  for (const stage of allStages) {
    await prisma.pipelineStage.upsert({
      where: { name: stage.name },
      update: {},
      create: stage,
    })
  }
  console.log('Pipeline stages ensured (7 PRD stages)')

  // ── 3. Industries — PRD's 13 categories only ─────────────────────────────
  const prdIndustries = [
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

  for (const name of prdIndustries) {
    await prisma.industry.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('Industries ensured (13 PRD categories)')

  // ── 4. Services ───────────────────────────────────────────────────────────
  const allServices = [
    { name: 'LOCOBUZZ', description: 'Social media management', isActive: true },
    { name: 'MEDIAWATCH', description: 'Media monitoring', isActive: true },
    { name: 'SHAREDVIEW', description: 'Shared analytics', isActive: true },
    { name: 'REPORTS', description: 'Custom reporting', isActive: true },
    { name: 'ADWATCH', description: 'Ad monitoring', isActive: true },
    { name: 'REPORT', description: 'Standard reporting', isActive: true },
    { name: 'REPORT (EXCEL)', description: 'Excel report exports', isActive: true },
    { name: 'LOCOBUZZ REPORT', description: 'Locobuzz analytics reports', isActive: true },
  ]

  for (const svc of allServices) {
    await prisma.service.upsert({
      where: { name: svc.name },
      update: {},
      create: svc,
    })
  }
  console.log('Services ensured')

  // ── 5. BD members ─────────────────────────────────────────────────────────
  const password = await bcrypt.hash('changeme123', 10)

  const bdMembers = [
    { firstName: 'Henne', lastName: 'Zarate', email: 'henne@company.com', role: 'BD_REP' as const },
    { firstName: 'Isten', lastName: 'Unknown', email: 'isten@company.com', role: 'BD_REP' as const },
    { firstName: 'Brian', lastName: 'Unknown', email: 'brian@company.com', role: 'BD_REP' as const },
    { firstName: 'Manager', lastName: 'Admin', email: 'manager@company.com', role: 'SALES_MANAGER' as const },
  ]

  for (const bd of bdMembers) {
    await prisma.bD.upsert({
      where: { email: bd.email },
      update: { firstName: bd.firstName, lastName: bd.lastName },
      create: { ...bd, password },
    })
  }
  console.log('BD members ensured')

  // ── 6. Date dimensions ────────────────────────────────────────────────────
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
      isQuarterEnd: [2, 5, 8, 11].includes(i),
    }
  })

  for (const m of months2026) {
    await prisma.dateDimension.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    })
  }
  console.log('Date dimensions ensured')

  // ── 7. Targets — from JSON dashboard.target (cumulative → incremental) ──
  const bdReps = await prisma.bD.findMany({ where: { role: 'BD_REP' } })

  // Step 3: Extract actual quotas from JSON. All 3 BDs have identical targets.
  const cumulativeTarget = data.henne_tracker.dashboard.target
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const cumulativeValues = monthKeys.map((k: string) => cumulativeTarget[k] || 0)
  const incrementalMonthly = cumulativeValues.map((v: number, i: number) => i === 0 ? v : v - cumulativeValues[i - 1])
  // Result: [130000, 110000, 100000, 95000, 90000, 85000, 75000, 70000, 65000, 0, 0, 0]

  const quarterKeys = ['q1_total', 'q2_total', 'q3_total', 'q4_total']
  const cumulativeQuarterly = quarterKeys.map((k: string) => cumulativeTarget[k] || 0)
  const incrementalQuarterly = cumulativeQuarterly.map((v: number, i: number) => i === 0 ? v : v - cumulativeQuarterly[i - 1])
  // Result: [710000, 860000, 690000, 200000]

  for (const bd of bdReps) {
    // Monthly targets
    for (let m = 1; m <= 12; m++) {
      const dateId = `dd-2026-${String(m).padStart(2, '0')}`
      await prisma.target.upsert({
        where: { id: `target-${bd.id}-M${m}-2026` },
        update: { quota: incrementalMonthly[m - 1] },
        create: {
          id: `target-${bd.id}-M${m}-2026`,
          quota: incrementalMonthly[m - 1],
          periodType: 'MONTHLY',
          dateId,
          bdId: bd.id,
        },
      })
    }

    // Quarterly targets
    for (let q = 0; q < 4; q++) {
      const dateId = `dd-2026-${String(q * 3 + 1).padStart(2, '0')}`
      await prisma.target.upsert({
        where: { id: `target-${bd.id}-Q${q + 1}-2026` },
        update: { quota: incrementalQuarterly[q] },
        create: {
          id: `target-${bd.id}-Q${q + 1}-2026`,
          quota: incrementalQuarterly[q],
          periodType: 'QUARTERLY',
          dateId,
          bdId: bd.id,
        },
      })
    }
  }
  console.log(`Targets seeded for ${bdReps.length} BD reps (from JSON dashboard.target)`)

  // ── 8. Build lookup maps ──────────────────────────────────────────────────
  const stageMap = Object.fromEntries(
    (await prisma.pipelineStage.findMany()).map((s) => [s.name, s])
  )
  const serviceMap = Object.fromEntries(
    (await prisma.service.findMany()).map((s) => [s.name, s])
  )
  const industryMap = Object.fromEntries(
    (await prisma.industry.findMany()).map((i) => [i.name, i])
  )
  const bdMap = Object.fromEntries(
    (await prisma.bD.findMany()).map((b) => [b.email, b])
  )

  // ── 9. Collect all deals from BD trackers ─────────────────────────────────
  const allDeals: { deal: DealRow; isClosedLost: boolean }[] = []
  for (const tracker of ['henne_tracker', 'isten_tracker', 'brian_tracker'] as const) {
    for (const deal of data[tracker].active_deals) {
      allDeals.push({ deal, isClosedLost: false })
    }
    for (const deal of data[tracker].closed_lost) {
      allDeals.push({ deal, isClosedLost: true })
    }
  }

  console.log(`Processing ${allDeals.length} deals...`)

  // Track created entities to avoid duplicates
  const clientCache: Record<string, string> = {}   // clientName -> clientId
  const contactCache: Record<string, string> = {}   // cleanedEmail -> contactId (Step 4: dedup)
  let dealsCreated = 0
  let clientsCreated = 0
  let contactsCreated = 0
  let paymentsCreated = 0

  for (let i = 0; i < allDeals.length; i++) {
    const { deal: d, isClosedLost } = allDeals[i]

    // Skip null BD deals (marketing leads, not pipeline deals)
    const bdEmail = BD_EMAIL_MAP[d.bd]
    if (!bdEmail) {
      continue
    }
    const bd = bdMap[bdEmail]

    // Determine stage (Step 2 + Step 7: null handling)
    let stageName: string
    if (isClosedLost) {
      stageName = 'Closed Lost'
    } else if (d.probability && PROBABILITY_TO_STAGE[d.probability]) {
      stageName = PROBABILITY_TO_STAGE[d.probability]
    } else if (d.monthly_subscription && d.monthly_subscription > 0) {
      stageName = 'Prospecting'   // Active deal with subscription but no probability
    } else {
      stageName = 'Inquiry'       // Early lead, no subscription, no probability
    }
    const stage = stageMap[stageName]
    if (!stage) {
      console.warn(`Skipping deal #${i + 1}: unknown stage "${stageName}"`)
      continue
    }

    // Get or create client (Step 5: normalized industry)
    const clientName = d.client.trim()
    let clientId = clientCache[clientName]
    if (!clientId) {
      const accountType = CLIENT_TYPE_MAP[d.client_type || 'ENTERPRISE'] || 'ENTERPRISE'
      const rawIndustry = d.industry
      const mappedIndustry = rawIndustry ? (INDUSTRY_NAME_MAP[rawIndustry] || rawIndustry) : null
      const industryId = mappedIndustry ? industryMap[mappedIndustry]?.id : null
      const client = await prisma.client.create({
        data: {
          name: clientName,
          brand: d.brand?.trim() || null,
          accountType,
          status: 'ACTIVE',
          industryId,
        },
      })
      clientId = client.id
      clientCache[clientName] = clientId
      clientsCreated++
    }

    // Step 4: Create or reuse contact (deduplicated by email or name+client)
    let contactId: string | null = null
    if (d.contact?.full_name) {
      const email = cleanEmail(d.contact.email)
      const nameParts = d.contact.full_name.trim().split(/\s+/)
      const firstName = nameParts[0] || 'Unknown'
      const lastName = nameParts.slice(1).join(' ') || 'Unknown'
      const contactEmail = email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`.substring(0, 100)

      // Cache key: use real email if available, otherwise name+client combo
      const cacheKey = email || `${d.contact.full_name.trim().toLowerCase()}::${clientName.toLowerCase()}`

      if (contactCache[cacheKey]) {
        contactId = contactCache[cacheKey]
      } else {
        const contact = await prisma.contact.create({
          data: {
            firstName: firstName.substring(0, 30),
            lastName: lastName.substring(0, 30),
            email: contactEmail,
            number: d.contact.phone ? String(d.contact.phone) : null,
            designation: d.contact.designation?.substring(0, 100) || null,
            decisionRank: 'TIER_1_ECONOMIC_BUYER',
            isPrimary: true,
            clientId,
          },
        })
        contactId = contact.id
        contactCache[cacheKey] = contact.id
        contactsCreated++
      }
    }

    // Resolve service
    const serviceName = d.service ? SERVICE_NAME_MAP[d.service] || d.service : null
    const service = serviceName ? serviceMap[serviceName] : null

    // Parse dates
    const startDate = d.start_date ? new Date(d.start_date) : null
    const dueDate = d.due_date ? new Date(d.due_date) : null
    const closedDate = d.contract_closed_date ? new Date(d.contract_closed_date) : null
    const initialMeetingDate = d.initial_meeting_date ? new Date(d.initial_meeting_date) : null

    // Step 7: Closed lost defaults
    const monthlySubscription = d.monthly_subscription || 0
    const duration = isClosedLost && !d.duration_months ? 0 : (d.duration_months || 12)
    const revenue = monthlySubscription * duration
    const isClosed = stageName === 'Closed Won' || stageName === 'Closed Lost'

    const dealName = `${clientName} – ${serviceName || 'Service'}`

    // Step 7: Build referral note
    const referralNote = d.referred_by && d.referred_by !== 'NONE' ? `Referred by: ${d.referred_by}` : null

    // Create deal
    const deal = await prisma.deal.create({
      data: {
        dealName,
        monthlySubscription,
        revenue: revenue || null,
        duration,
        isClosed,
        proposalRevisionCount: Number(d.proposal_revisions) || 0,
        proposalLink: d.proposal_links,
        contractLink: d.contract_links,
        leadSource: LEAD_SOURCE_MAP[d.lead_source || 'Outbound'] || 'OUTBOUND',
        salesCycleDays: d.sales_cycle ? parseInt(String(d.sales_cycle)) || null : null,
        stageId: stage.id,
        bdId: bd.id,
        clientId,
        serviceId: service?.id || null,
        startDate,
        dueDate,
        closedDate: stageName === 'Closed Won' ? (closedDate || startDate) : null,
        lastStageUpdateAt: startDate || new Date(),
        initialMeetingDate,
      },
    })

    // Create audit log entry for current stage (Step 7: include referral in notes)
    const auditNotes = [
      d.remarks,
      referralNote,
    ].filter(Boolean).join(' | ') || (isClosed ? `Deal ${stageName.toLowerCase()}.` : 'In progress.')

    await prisma.dealAuditLog.create({
      data: {
        dealId: deal.id,
        stageId: stage.id,
        changedById: bd.id,
        enteredAt: startDate || new Date(),
        exitedAt: isClosed ? (closedDate || startDate || new Date()) : null,
        notes: auditNotes,
        remarks: d.remarks || null,
        actionPlan: d.action_plan || null,
      },
    })

    // Create deal-contact link
    if (contactId) {
      await prisma.dealContact.create({
        data: {
          dealId: deal.id,
          contactId,
          roleInDeal: 'Primary Contact',
          isPrimary: true,
        },
      })
    }

    // Step 8: Create projection for open deals (using Prisma client, not raw SQL)
    if (!isClosed && monthlySubscription > 0) {
      const probabilityPct = STAGE_PROBABILITY[stageName] || 50
      const weightedValue = revenue * probabilityPct / 100

      await prisma.dealProjection.create({
        data: {
          dealId: deal.id,
          bdId: bd.id,
          projectedAmount: revenue,
          probabilityPct,
          weightedValue,
        },
      })
    }

    // Step 6: Import revenue breakdown → Payment table
    if (d.revenue_breakdown) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      for (let m = 0; m < 12; m++) {
        const amount = d.revenue_breakdown[monthNames[m]]
        if (amount && amount > 0) {
          const dateId = `dd-2026-${String(m + 1).padStart(2, '0')}`
          await prisma.payment.create({
            data: {
              amount,
              dateId,
              dealId: deal.id,
            },
          })
          paymentsCreated++
        }
      }
    }

    dealsCreated++
  }

  console.log(`\nSeeding complete!`)
  console.log(`  Clients created: ${clientsCreated}`)
  console.log(`  Contacts created: ${contactsCreated} (deduplicated)`)
  console.log(`  Deals created: ${dealsCreated}`)
  console.log(`  Payments created: ${paymentsCreated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

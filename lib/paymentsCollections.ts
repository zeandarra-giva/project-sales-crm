type PaymentWithPeriod = {
  id: string
  amount: number
  date?: {
    year: number
    month: number
    quarter: number
  } | null
}

type DealWithCollections = {
  id: string
  dealName: string
  monthlySubscription: number
  revenue: number
  duration: number
  startDate: Date | string | null
  closedDate?: Date | string | null
  terminatedAt?: Date | string | null
  bdId: string
  bd?: {
    id: string
    firstName: string
    lastName: string
  }
  client?: {
    id: string
    name: string
    accountType?: string | null
  }
  payments: PaymentWithPeriod[]
}

export type CollectionLogItem = {
  id: string
  amount: number
  dealId: string
  dealName: string
  clientName: string | null
  bdId: string
  bdName: string
  billingYear: number | null
  billingMonth: number | null
  billingQuarter: number | null
  billingLabel: string
  status: 'Received' | 'Unassigned'
}

export type CollectionDealSummary = {
  dealId: string
  dealName: string
  clientName: string | null
  accountType: string | null
  bdId: string
  bdName: string
  startDate: string | null
  terminatedAt: string | null
  duration: number
  monthlySubscription: number
  bookedRevenue: number
  expectedToDate: number
  collectedRevenue: number
  outstandingRevenue: number
  overdueRevenue: number
  paidMonths: number
  unpaidMonths: number
  overdueMonths: number
  collectionPct: number
  nextDueLabel: string | null
  lastPaidLabel: string | null
  followUpStatus: 'Current' | 'Due This Month' | 'Overdue'
  countsTowardBookedRevenue: boolean
}

export type CollectionOverview = {
  summary: {
    bookedRevenue: number
    expectedRevenue: number
    collectedRevenue: number
    outstandingRevenue: number
    overdueRevenue: number
    coveragePct: number
    trackedDeals: number
    receivedEntries: number
    unassignedEntries: number
  }
  monthlyTrend: Array<{
    monthKey: string
    label: string
    expected: number
    collected: number
    booked: number
  }>
  deals: CollectionDealSummary[]
  followUps: CollectionDealSummary[]
  logs: CollectionLogItem[]
  filterYears: number[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toMonthStart(value: Date | string): Date {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatMonthLabel(year: number, month: number) {
  return `${MONTH_LABELS[month - 1]} ${year}`
}

function quarterForMonth(month: number) {
  return Math.ceil(month / 3)
}

function resolveScopeMonths(year?: number, quarter?: number) {
  if (!year) return null
  const months = quarter
    ? [((quarter - 1) * 3) + 1, ((quarter - 1) * 3) + 2, ((quarter - 1) * 3) + 3]
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  return new Set(months.map((month) => formatMonthKey(year, month)))
}

function isInScope(scope: Set<string> | null, year: number, month: number) {
  return !scope || scope.has(formatMonthKey(year, month))
}

export function buildCollectionsOverview(
  deals: DealWithCollections[],
  options?: {
    year?: number
    quarter?: number
  }
): CollectionOverview {
  const now = new Date()
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const previousMonthStart = addMonths(currentMonthStart, -1)
  const scope = resolveScopeMonths(options?.year, options?.quarter)

  const monthlyTrend = new Map<string, { monthKey: string; label: string; expected: number; collected: number; booked: number }>()
  const filterYears = new Set<number>()
  const logs: CollectionLogItem[] = []
  const dealSummaries: CollectionDealSummary[] = []

  let bookedRevenue = 0
  let expectedRevenue = 0
  let collectedRevenue = 0
  let overdueRevenue = 0
  let receivedEntries = 0
  let unassignedEntries = 0

  for (const deal of deals) {
    const bdName = deal.bd ? `${deal.bd.firstName} ${deal.bd.lastName}` : 'Unknown BD'
    const startDate = deal.startDate ? toMonthStart(deal.startDate) : null
    const terminatedAt = deal.terminatedAt ? toMonthStart(deal.terminatedAt) : null
    const monthlySubscription = Number(deal.monthlySubscription || 0)
    const bookedValue = Number(deal.revenue || monthlySubscription * Number(deal.duration || 0))
    const paymentMap = new Map<string, number>()
    let dealCollected = 0
    let dealExpectedToDate = 0
    let dealOverdueRevenue = 0
    let paidMonths = 0
    let unpaidMonths = 0
    let overdueMonths = 0
    let lastPaidLabel: string | null = null
    let nextDueLabel: string | null = null

    for (const payment of deal.payments) {
      const amount = Number(payment.amount || 0)
      const period = payment.date
      if (period) {
        const monthKey = formatMonthKey(period.year, period.month)
        paymentMap.set(monthKey, (paymentMap.get(monthKey) || 0) + amount)
        filterYears.add(period.year)
        if (isInScope(scope, period.year, period.month)) {
          const monthBucket = monthlyTrend.get(monthKey) || {
            monthKey,
            label: formatMonthLabel(period.year, period.month),
            expected: 0,
            collected: 0,
            booked: 0,
          }
          monthBucket.collected += amount
          monthlyTrend.set(monthKey, monthBucket)
          collectedRevenue += amount
        }
        dealCollected += amount
        lastPaidLabel = formatMonthLabel(period.year, period.month)
        receivedEntries += 1
      } else {
        unassignedEntries += 1
      }

      logs.push({
        id: payment.id,
        amount,
        dealId: deal.id,
        dealName: deal.dealName,
        clientName: deal.client?.name || null,
        bdId: deal.bdId,
        bdName,
        billingYear: period?.year ?? null,
        billingMonth: period?.month ?? null,
        billingQuarter: period?.quarter ?? null,
        billingLabel: period ? formatMonthLabel(period.year, period.month) : 'Unassigned period',
        status: period ? 'Received' : 'Unassigned',
      })
    }

    let countsTowardBookedRevenue = false
    if (startDate) {
      filterYears.add(startDate.getUTCFullYear())
      for (let monthOffset = 0; monthOffset < Number(deal.duration || 0); monthOffset += 1) {
        const dueMonth = addMonths(startDate, monthOffset)
        if (terminatedAt && dueMonth > terminatedAt) {
          break
        }
        const dueYear = dueMonth.getUTCFullYear()
        const dueMonthNumber = dueMonth.getUTCMonth() + 1
        const monthKey = formatMonthKey(dueYear, dueMonthNumber)
        const paidAmount = paymentMap.get(monthKey) || 0
        const remaining = Math.max(monthlySubscription - paidAmount, 0)

        if (isInScope(scope, dueYear, dueMonthNumber)) {
          countsTowardBookedRevenue = true
          const monthBucket = monthlyTrend.get(monthKey) || {
            monthKey,
            label: formatMonthLabel(dueYear, dueMonthNumber),
            expected: 0,
            collected: 0,
            booked: 0,
          }
          monthBucket.expected += monthlySubscription
          monthlyTrend.set(monthKey, monthBucket)
          expectedRevenue += monthlySubscription
        }

        if (deal.closedDate) {
          const closed = new Date(deal.closedDate)
          if (countsTowardBookedRevenue && closed.getUTCFullYear() === dueYear && closed.getUTCMonth() + 1 === dueMonthNumber && isInScope(scope, dueYear, dueMonthNumber)) {
            const monthBucket = monthlyTrend.get(monthKey) || {
              monthKey,
              label: formatMonthLabel(dueYear, dueMonthNumber),
              expected: 0,
              collected: 0,
              booked: 0,
            }
            monthBucket.booked += bookedValue
            monthlyTrend.set(monthKey, monthBucket)
          }
        }

        if (dueMonth <= currentMonthStart) {
          dealExpectedToDate += monthlySubscription
          if (remaining <= 0) {
            paidMonths += 1
          } else {
            unpaidMonths += 1
            if (!nextDueLabel) {
              nextDueLabel = formatMonthLabel(dueYear, dueMonthNumber)
            }
          }
        }

        if (dueMonth < currentMonthStart && remaining > 0) {
          overdueMonths += 1
          dealOverdueRevenue += remaining
        }
      }
    }

    if (countsTowardBookedRevenue) {
      bookedRevenue += bookedValue
    }

    overdueRevenue += dealOverdueRevenue

    const outstandingRevenue = Math.max(bookedValue - dealCollected, 0)
    const followUpStatus: CollectionDealSummary['followUpStatus'] =
      dealOverdueRevenue > 0 ? 'Overdue' : unpaidMonths > 0 ? 'Due This Month' : 'Current'

    dealSummaries.push({
      dealId: deal.id,
      dealName: deal.dealName,
      clientName: deal.client?.name || null,
      accountType: deal.client?.accountType || null,
      bdId: deal.bdId,
      bdName,
      startDate: deal.startDate ? new Date(deal.startDate).toISOString() : null,
      terminatedAt: deal.terminatedAt ? new Date(deal.terminatedAt).toISOString() : null,
      duration: Number(deal.duration || 0),
      monthlySubscription,
      bookedRevenue: bookedValue,
      expectedToDate: dealExpectedToDate,
      collectedRevenue: dealCollected,
      outstandingRevenue,
      overdueRevenue: dealOverdueRevenue,
      paidMonths,
      unpaidMonths,
      overdueMonths,
      collectionPct: bookedValue ? Number(((dealCollected / bookedValue) * 100).toFixed(1)) : 0,
      nextDueLabel,
      lastPaidLabel,
      followUpStatus,
      countsTowardBookedRevenue,
    })
  }

  dealSummaries.sort((a, b) => b.overdueRevenue - a.overdueRevenue || b.outstandingRevenue - a.outstandingRevenue)
  logs.sort((a, b) => {
    const aKey = a.billingYear && a.billingMonth ? `${a.billingYear}-${String(a.billingMonth).padStart(2, '0')}` : ''
    const bKey = b.billingYear && b.billingMonth ? `${b.billingYear}-${String(b.billingMonth).padStart(2, '0')}` : ''
    return bKey.localeCompare(aKey) || b.amount - a.amount
  })

  return {
    summary: {
      bookedRevenue,
      expectedRevenue,
      collectedRevenue,
      outstandingRevenue: Math.max(expectedRevenue - collectedRevenue, 0),
      overdueRevenue,
      coveragePct: expectedRevenue ? Number(((collectedRevenue / expectedRevenue) * 100).toFixed(1)) : 0,
      trackedDeals: dealSummaries.length,
      receivedEntries,
      unassignedEntries,
    },
    monthlyTrend: Array.from(monthlyTrend.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    deals: dealSummaries,
    followUps: dealSummaries.filter((deal) => deal.followUpStatus !== 'Current').slice(0, 8),
    logs,
    filterYears: Array.from(filterYears).sort((a, b) => a - b),
  }
}

export function resolveBillingDateParts(year?: number, month?: number) {
  if (!year || !month) return null
  return {
    year,
    month,
    quarter: quarterForMonth(month),
    label: formatMonthLabel(year, month),
    key: formatMonthKey(year, month),
  }
}

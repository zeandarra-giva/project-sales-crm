// index-dev.js
import { Motia, initIII } from "motia";

// steps/events/onDealStageChanged.step.ts
import { logger } from "motia";
import { z } from "zod";

// lib/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

// lib/notifications.ts
async function createTeamNotification(payload) {
  const recipients = await prisma.bD.findMany({
    where: { isActive: true },
    select: { id: true }
  });
  if (recipients.length === 0) {
    return { count: 0 };
  }
  return prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      bdId: recipient.id,
      type: payload.type,
      triggeredBy: payload.triggeredBy,
      content: payload.content,
      dealId: payload.dealId ?? null,
      scheduledAt: payload.scheduledAt ?? null
    }))
  });
}

// steps/events/onDealStageChanged.step.ts
var stageChangedSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  previousStageId: z.string(),
  previousStageName: z.string(),
  newStageId: z.string(),
  newStageName: z.string(),
  bdId: z.string(),
  changedById: z.string(),
  isClosed: z.boolean()
});
var config = {
  name: "OnDealStageChanged",
  description: "Listens for deal.stage.changed events and creates a notification for the BD rep",
  triggers: [
    {
      type: "queue",
      topic: "deal.stage.changed",
      input: stageChangedSchema
    }
  ],
  flows: ["notification-system"]
};
var handler = async (input) => {
  try {
    const data = stageChangedSchema.parse(input);
    const closedPrefix = data.isClosed ? data.newStageName === "Closed Won" ? "\u{1F389} Deal won! " : "\u274C Deal lost. " : "";
    const content = `${closedPrefix}"${data.dealName}" moved from ${data.previousStageName} to ${data.newStageName}.`;
    await createTeamNotification({
      content,
      type: "STAGE_CHANGE",
      triggeredBy: "STAGE_CHANGE",
      dealId: data.dealId
    });
    logger.info("Stage change notification created", {
      dealId: data.dealId,
      bdId: data.bdId,
      from: data.previousStageName,
      to: data.newStageName
    });
  } catch (error) {
    logger.error("Failed to create stage change notification", {
      error: error.message,
      input
    });
  }
};

// steps/events/onDealCreated.step.ts
import { logger as logger2 } from "motia";
import { z as z2 } from "zod";
var dealCreatedSchema = z2.object({
  dealId: z2.string(),
  dealName: z2.string(),
  bdId: z2.string(),
  stageId: z2.string(),
  revenue: z2.number().nullable().optional(),
  expectedCloseDate: z2.union([z2.string(), z2.date()]).optional()
});
var config2 = {
  name: "OnDealCreated",
  description: "Listens for deal.created events to initialize projections and sending assignments",
  triggers: [
    {
      type: "queue",
      topic: "deal.created",
      input: dealCreatedSchema
    }
  ],
  flows: ["sales-pipeline"]
};
var handler2 = async (input) => {
  try {
    const data = dealCreatedSchema.parse(input);
    const { dealId, bdId, dealName, revenue, expectedCloseDate } = data;
    const projectedAmount = revenue || 0;
    await prisma.dealProjection.create({
      data: {
        dealId,
        bdId,
        projectedAmount
      }
      // Safely ignore if projection already exists somehow
    }).catch((e) => logger2.warn("Projection might already exist", { e }));
    logger2.info("onDealCreated processes completed", { dealId, bdId });
  } catch (error) {
    logger2.error("Failed to process deal.created", { error: error.message, input });
  }
};

// steps/cron/checkStuckDeals.step.ts
import { logger as logger3 } from "motia";
var config3 = {
  name: "Check Stuck Deals",
  description: "Daily 8 AM: find deals stuck beyond stage duration",
  triggers: [
    {
      type: "cron",
      expression: "0 8 * * *"
      // Every day at 8:00 AM
    }
  ]
};
var handler3 = async () => {
  const stuckDeals = await prisma.$queryRaw`
    SELECT d.id, d.deal_name, d.bd_id, ps.name as stage_name,
    ps.target_duration_days,
    EXTRACT(DAY FROM NOW() - d.last_stage_update_at)::int as days_in_stage
    FROM deal d
    JOIN pipeline_stage ps ON d.stage_id = ps.id
    WHERE d.is_closed = false
    AND EXTRACT(DAY FROM NOW() - d.last_stage_update_at) >
    ps.target_duration_days
  `;
  for (const deal of stuckDeals) {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: deal.id,
        type: "DEAL_STUCK",
        createdAt: { gte: today }
      }
    });
    if (!existing) {
      await createTeamNotification({
        dealId: deal.id,
        type: "DEAL_STUCK",
        triggeredBy: "DAYS_IN_STAGE_EXCEEDED",
        content: `Deal stuck in ${deal.stage_name}: "${deal.deal_name}" has been in ${deal.stage_name} for ${deal.days_in_stage} days (target: ${deal.target_duration_days} days)`
      });
      logger3.info(`Stuck deal notification: ${deal.deal_name}`);
    }
  }
  logger3.info(`Checked ${stuckDeals.length} stuck deals`);
};

// steps/cron/checkBillingDue.step.ts
import { logger as logger4 } from "motia";

// lib/paymentsCollections.ts
var MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function toMonthStart(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}
function formatMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
function formatMonthLabel(year, month) {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}
function resolveScopeMonths(year, quarter) {
  if (!year) return null;
  const months = quarter ? [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return new Set(months.map((month) => formatMonthKey(year, month)));
}
function isInScope(scope, year, month) {
  return !scope || scope.has(formatMonthKey(year, month));
}
function buildCollectionsOverview(deals, options) {
  const now = /* @__PURE__ */ new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const scope = resolveScopeMonths(options?.year, options?.quarter);
  const monthlyTrend = /* @__PURE__ */ new Map();
  const filterYears = /* @__PURE__ */ new Set();
  const logs = [];
  const dealSummaries = [];
  let bookedRevenue = 0;
  let expectedRevenue = 0;
  let collectedRevenue = 0;
  let overdueRevenue = 0;
  let receivedEntries = 0;
  let unassignedEntries = 0;
  for (const deal of deals) {
    const bdName = deal.bd ? `${deal.bd.firstName} ${deal.bd.lastName}` : "Unknown BD";
    const startDate = deal.startDate ? toMonthStart(deal.startDate) : null;
    const terminatedAt = deal.terminatedAt ? toMonthStart(deal.terminatedAt) : null;
    const monthlySubscription = Number(deal.monthlySubscription || 0);
    const bookedValue = Number(deal.revenue || monthlySubscription * Number(deal.duration || 0));
    const paymentMap = /* @__PURE__ */ new Map();
    let dealCollected = 0;
    let dealExpectedToDate = 0;
    let dealOverdueRevenue = 0;
    let paidMonths = 0;
    let unpaidMonths = 0;
    let overdueMonths = 0;
    let lastPaidLabel = null;
    let nextDueLabel = null;
    for (const payment of deal.payments) {
      const amount = Number(payment.amount || 0);
      const period = payment.date;
      if (period) {
        const monthKey = formatMonthKey(period.year, period.month);
        paymentMap.set(monthKey, (paymentMap.get(monthKey) || 0) + amount);
        filterYears.add(period.year);
        if (isInScope(scope, period.year, period.month)) {
          const monthBucket = monthlyTrend.get(monthKey) || {
            monthKey,
            label: formatMonthLabel(period.year, period.month),
            expected: 0,
            collected: 0,
            booked: 0
          };
          monthBucket.collected += amount;
          monthlyTrend.set(monthKey, monthBucket);
          collectedRevenue += amount;
        }
        dealCollected += amount;
        lastPaidLabel = formatMonthLabel(period.year, period.month);
        receivedEntries += 1;
      } else {
        unassignedEntries += 1;
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
        billingLabel: period ? formatMonthLabel(period.year, period.month) : "Unassigned period",
        status: period ? "Received" : "Unassigned"
      });
    }
    let countsTowardBookedRevenue = false;
    if (startDate) {
      filterYears.add(startDate.getUTCFullYear());
      for (let monthOffset = 0; monthOffset < Number(deal.duration || 0); monthOffset += 1) {
        const dueMonth = addMonths(startDate, monthOffset);
        if (terminatedAt && dueMonth > terminatedAt) {
          break;
        }
        const dueYear = dueMonth.getUTCFullYear();
        const dueMonthNumber = dueMonth.getUTCMonth() + 1;
        const monthKey = formatMonthKey(dueYear, dueMonthNumber);
        const paidAmount = paymentMap.get(monthKey) || 0;
        const remaining = Math.max(monthlySubscription - paidAmount, 0);
        if (isInScope(scope, dueYear, dueMonthNumber)) {
          countsTowardBookedRevenue = true;
          const monthBucket = monthlyTrend.get(monthKey) || {
            monthKey,
            label: formatMonthLabel(dueYear, dueMonthNumber),
            expected: 0,
            collected: 0,
            booked: 0
          };
          monthBucket.expected += monthlySubscription;
          monthlyTrend.set(monthKey, monthBucket);
          expectedRevenue += monthlySubscription;
        }
        if (deal.closedDate) {
          const closed = new Date(deal.closedDate);
          if (countsTowardBookedRevenue && closed.getUTCFullYear() === dueYear && closed.getUTCMonth() + 1 === dueMonthNumber && isInScope(scope, dueYear, dueMonthNumber)) {
            const monthBucket = monthlyTrend.get(monthKey) || {
              monthKey,
              label: formatMonthLabel(dueYear, dueMonthNumber),
              expected: 0,
              collected: 0,
              booked: 0
            };
            monthBucket.booked += bookedValue;
            monthlyTrend.set(monthKey, monthBucket);
          }
        }
        if (dueMonth <= currentMonthStart) {
          dealExpectedToDate += monthlySubscription;
          if (remaining <= 0) {
            paidMonths += 1;
          } else {
            unpaidMonths += 1;
            if (!nextDueLabel) {
              nextDueLabel = formatMonthLabel(dueYear, dueMonthNumber);
            }
          }
        }
        if (dueMonth < currentMonthStart && remaining > 0) {
          overdueMonths += 1;
          dealOverdueRevenue += remaining;
        }
      }
    }
    if (countsTowardBookedRevenue) {
      bookedRevenue += bookedValue;
    }
    overdueRevenue += dealOverdueRevenue;
    const outstandingRevenue = Math.max(bookedValue - dealCollected, 0);
    const followUpStatus = dealOverdueRevenue > 0 ? "Overdue" : unpaidMonths > 0 ? "Due This Month" : "Current";
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
      collectionPct: bookedValue ? Number((dealCollected / bookedValue * 100).toFixed(1)) : 0,
      nextDueLabel,
      lastPaidLabel,
      followUpStatus,
      countsTowardBookedRevenue
    });
  }
  dealSummaries.sort((a, b) => b.overdueRevenue - a.overdueRevenue || b.outstandingRevenue - a.outstandingRevenue);
  logs.sort((a, b) => {
    const aKey = a.billingYear && a.billingMonth ? `${a.billingYear}-${String(a.billingMonth).padStart(2, "0")}` : "";
    const bKey = b.billingYear && b.billingMonth ? `${b.billingYear}-${String(b.billingMonth).padStart(2, "0")}` : "";
    return bKey.localeCompare(aKey) || b.amount - a.amount;
  });
  return {
    summary: {
      bookedRevenue,
      expectedRevenue,
      collectedRevenue,
      outstandingRevenue: Math.max(expectedRevenue - collectedRevenue, 0),
      overdueRevenue,
      coveragePct: expectedRevenue ? Number((collectedRevenue / expectedRevenue * 100).toFixed(1)) : 0,
      trackedDeals: dealSummaries.length,
      receivedEntries,
      unassignedEntries
    },
    monthlyTrend: Array.from(monthlyTrend.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    deals: dealSummaries,
    followUps: dealSummaries.filter((deal) => deal.followUpStatus !== "Current").slice(0, 8),
    logs,
    filterYears: Array.from(filterYears).sort((a, b) => a - b)
  };
}

// steps/cron/checkBillingDue.step.ts
var config4 = {
  name: "Check Billing Due",
  description: "Daily 8:30 AM: notify BD members about unpaid or overdue subscription billings",
  triggers: [
    {
      type: "cron",
      expression: "30 8 * * *"
    }
  ]
};
var handler4 = async () => {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const deals = await prisma.deal.findMany({
    where: {
      stage: { name: "Closed Won" }
    },
    include: {
      bd: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { id: true, name: true, accountType: true } },
      payments: {
        include: {
          date: { select: { year: true, month: true, quarter: true } }
        }
      }
    }
  });
  const overview = buildCollectionsOverview(
    deals.map((deal) => ({
      id: deal.id,
      dealName: deal.dealName,
      monthlySubscription: Number(deal.monthlySubscription || 0),
      revenue: Number(deal.revenue || 0),
      duration: deal.duration,
      startDate: deal.startDate,
      closedDate: deal.closedDate,
      terminatedAt: deal.terminatedAt,
      bdId: deal.bdId,
      bd: deal.bd,
      client: deal.client,
      payments: deal.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        date: payment.date ?? null
      }))
    }))
  );
  for (const followUp of overview.followUps) {
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: followUp.dealId,
        type: "FOLLOW_UP_DUE",
        createdAt: { gte: today }
      }
    });
    if (existing) continue;
    const content = followUp.followUpStatus === "Overdue" ? `Billing overdue for "${followUp.dealName}". ${followUp.overdueMonths} month(s) remain unpaid totaling ${Math.round(followUp.overdueRevenue)}.` : `Billing due this month for "${followUp.dealName}". Next due period: ${followUp.nextDueLabel || "current billing cycle"}.`;
    await createTeamNotification({
      dealId: followUp.dealId,
      type: "FOLLOW_UP_DUE",
      triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
      content
    }).catch((error) => logger4.warn("Failed to create billing follow-up notification", { error, dealId: followUp.dealId }));
  }
  logger4.info(`Checked ${overview.followUps.length} billing follow-up items`);
};

// steps/cron/checkActionPlanDue.step.ts
import { logger as logger5 } from "motia";
var config5 = {
  name: "Check Action Plan Due",
  description: "Daily 8:15 AM: notify BD members when current action plans are due or overdue",
  triggers: [
    {
      type: "cron",
      expression: "15 8 * * *"
    }
  ]
};
var handler5 = async () => {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const dueActions = await prisma.dealAuditLog.findMany({
    where: {
      exitedAt: null,
      actionPlanDueDate: { lte: /* @__PURE__ */ new Date() },
      deal: {
        isClosed: false,
        contractStatus: { not: "TERMINATED" }
      }
    },
    include: {
      deal: {
        select: {
          id: true,
          dealName: true,
          bdId: true
        }
      },
      stage: { select: { name: true } }
    }
  });
  for (const action of dueActions) {
    const existing = await prisma.notification.findFirst({
      where: {
        dealId: action.dealId,
        type: "ACTION_PLAN_DUE",
        createdAt: { gte: today }
      }
    });
    if (existing) continue;
    await createTeamNotification({
      dealId: action.dealId,
      type: "ACTION_PLAN_DUE",
      triggeredBy: "ACTION_PLAN_PASSED",
      content: `Action plan for "${action.deal.dealName}" in ${action.stage.name} is due. Review the next steps and update the deal.`
    }).catch((error) => logger5.warn("Failed to create action-plan notification", { error, dealId: action.dealId }));
  }
  logger5.info(`Checked ${dueActions.length} due action plans`);
};

// steps/api/targets/upsertQuarterly.step.ts
import { logger as logger6 } from "motia";

// lib/auth.ts
import jwt from "jsonwebtoken";
var ENV_JWT_SECRET = process.env.JWT_SECRET;
if (!ENV_JWT_SECRET && process.env.NODE_ENV == "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
}
var JWT_SECRET = ENV_JWT_SECRET || "change-me-to-a-32-char-random-string";
var JWT_EXPIRE_MINUTES = parseInt(process.env.JWT_EXPIRE_MINUTES || "1440", 10);
var JWT_EXPIRE_SECONDS = JWT_EXPIRE_MINUTES * 60;
var AuthError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
};
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE_SECONDS
    // number (seconds) — always valid, avoids StringValue brand issue
  });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new AuthError(error.message || "Invalid token");
  }
}
async function authenticate(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    throw new AuthError("No authorization header");
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new AuthError("No token provided");
  }
  const payload = verifyToken(token);
  const bd = await prisma.bD.findUnique({
    where: { id: payload.bdId }
  });
  if (!bd) {
    throw new AuthError("User not found");
  }
  if (!bd.isActive) {
    throw new AuthError("Account is deactivated");
  }
  const { password, ...user } = bd;
  return user;
}

// steps/api/targets/upsertQuarterly.step.ts
import { z as z3 } from "zod";
import { Prisma } from "@prisma/client";
var bodySchema = z3.object({
  year: z3.number().int().min(2e3).max(2100),
  quarter: z3.number().int().min(1).max(4),
  targets: z3.array(z3.object({
    id: z3.string().optional(),
    bdId: z3.string().uuid(),
    quota: z3.number().min(0)
  })).min(1)
});
var config6 = {
  name: "UpsertQuarterlyTargets",
  description: "Bulk create or update quarterly quota targets for active BDs",
  triggers: [
    { type: "http", method: "PUT", path: "/api/targets/quarterly" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler6 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can update quarterly targets" } };
    }
    const parsed = bodySchema.safeParse(req.request.body);
    if (!parsed.success) {
      return { status: 400, body: { error: "Validation failed", details: parsed.error.flatten() } };
    }
    const { year, quarter, targets } = parsed.data;
    const quarterMonth = (quarter - 1) * 3 + 1;
    const activeReps = await prisma.bD.findMany({
      where: { isActive: true, role: "BD_REP", id: { in: targets.map((target) => target.bdId) } },
      select: { id: true }
    });
    const allowedIds = new Set(activeReps.map((rep) => rep.id));
    if (allowedIds.size !== targets.length) {
      return { status: 400, body: { error: "Targets can only be set for active BD reps" } };
    }
    const date = await prisma.dateDimension.findFirst({
      where: { year, quarter, month: quarterMonth, day: 1 },
      select: { id: true }
    });
    if (!date) {
      return { status: 404, body: { error: "Date dimension row not found for selected quarter" } };
    }
    await prisma.$transaction(async (tx) => {
      for (const target of targets) {
        const existing = await tx.target.findFirst({
          where: {
            bdId: target.bdId,
            periodType: "QUARTERLY",
            dateId: date.id
          },
          select: { id: true }
        });
        if (existing) {
          await tx.target.update({
            where: { id: existing.id },
            data: { quota: new Prisma.Decimal(target.quota) }
          });
        } else {
          await tx.target.create({
            data: {
              bdId: target.bdId,
              dateId: date.id,
              periodType: "QUARTERLY",
              quota: new Prisma.Decimal(target.quota)
            }
          });
        }
      }
    });
    const savedTargets = await prisma.target.findMany({
      where: {
        periodType: "QUARTERLY",
        dateId: date.id
      },
      include: {
        bd: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    return {
      status: 200,
      body: {
        year,
        quarter,
        targets: savedTargets.map((target) => ({
          id: target.id,
          bdId: target.bdId,
          bdName: `${target.bd.firstName} ${target.bd.lastName}`,
          role: target.bd.role,
          quota: Number(target.quota)
        }))
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger6.error("Failed to upsert quarterly targets", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/targets/listQuarterly.step.ts
import { logger as logger7 } from "motia";
var config7 = {
  name: "ListQuarterlyTargets",
  description: "List editable quarterly quota targets for all active BDs",
  triggers: [
    { type: "http", method: "GET", path: "/api/targets/quarterly" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler7 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can view quarterly targets" } };
    }
    const year = Number(req.request.queryParams?.year);
    const quarter = Number(req.request.queryParams?.quarter);
    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return { status: 400, body: { error: "year and quarter are required" } };
    }
    const quarterMonth = (quarter - 1) * 3 + 1;
    const date = await prisma.dateDimension.findFirst({
      where: { year, quarter, month: quarterMonth, day: 1 },
      select: { id: true }
    });
    if (!date) {
      return { status: 404, body: { error: "Date dimension row not found for selected quarter" } };
    }
    const [bds, targets] = await Promise.all([
      prisma.bD.findMany({
        where: { isActive: true, role: "BD_REP" },
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        orderBy: [{ firstName: "asc" }]
      }),
      prisma.target.findMany({
        where: {
          periodType: "QUARTERLY",
          dateId: date.id
        },
        select: { id: true, bdId: true, quota: true }
      })
    ]);
    const targetMap = new Map(targets.map((target) => [target.bdId, target]));
    return {
      status: 200,
      body: {
        year,
        quarter,
        targets: bds.map((bd) => {
          const existing = targetMap.get(bd.id);
          return {
            id: existing?.id ?? null,
            bdId: bd.id,
            bdName: `${bd.firstName} ${bd.lastName}`,
            role: bd.role,
            quota: Number(existing?.quota ?? 0)
          };
        })
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger7.error("Failed to list quarterly targets", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/services/update.step.ts
import { logger as logger8 } from "motia";
import { z as z4 } from "zod";
var config8 = {
  name: "UpdateService",
  description: "Updates an existing service",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/services/:id",
      bodySchema: z4.object({
        name: z4.string().min(1).optional(),
        description: z4.string().optional(),
        isActive: z4.boolean().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler8 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage services" } };
    }
    const { id } = req.request.pathParams;
    const { name, description, isActive } = req.request.body;
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...name !== void 0 && { name: name.trim() },
        ...description !== void 0 && { description: description?.trim() || null },
        ...isActive !== void 0 && { isActive }
      }
    });
    return { status: 200, body: service };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2025") return { status: 404, body: { error: "Service not found" } };
    if (error.code === "P2002") return { status: 409, body: { error: "A service with this name already exists" } };
    logger8.error("Failed to update service", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/services/list.step.ts
import { logger as logger9 } from "motia";
var config9 = {
  name: "ListServices",
  description: "Returns all active services",
  triggers: [
    { type: "http", method: "GET", path: "/api/services" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler9 = async (req, ctx) => {
  try {
    await authenticate(req.request);
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });
    return { status: 200, body: services };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger9.error("Failed to list services", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/services/delete.step.ts
import { logger as logger10 } from "motia";
var config10 = {
  name: "DeleteService",
  description: "Soft-deletes (deactivates) a service",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/services/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler10 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage services" } };
    }
    const { id } = req.request.pathParams;
    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false }
    });
    return { status: 200, body: { success: true, id: service.id } };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2025") return { status: 404, body: { error: "Service not found" } };
    logger10.error("Failed to delete service", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/services/create.step.ts
import { logger as logger11 } from "motia";
import { z as z5 } from "zod";
var config11 = {
  name: "CreateService",
  description: "Creates a new service",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/services",
      bodySchema: z5.object({
        name: z5.string().min(1),
        description: z5.string().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler11 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage services" } };
    }
    const { name, description } = req.request.body;
    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: true
      }
    });
    return { status: 201, body: service };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2002") return { status: 409, body: { error: "A service with this name already exists" } };
    logger11.error("Failed to create service", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/reporting/periods.step.ts
import { logger as logger12 } from "motia";
var config12 = {
  name: "GetReportingPeriods",
  description: "List available reporting years from deals and growth table entries",
  triggers: [
    { type: "http", method: "GET", path: "/api/reporting/periods" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler12 = async (req, _ctx) => {
  try {
    await authenticate(req.request);
    const now = /* @__PURE__ */ new Date();
    const currentYear = now.getFullYear();
    const [growthEntries, deals] = await Promise.all([
      prisma.growthEntry.findMany({
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" }
      }),
      prisma.deal.findMany({
        select: { startDate: true, closedDate: true }
      })
    ]);
    const years = /* @__PURE__ */ new Set([currentYear]);
    for (const entry of growthEntries) {
      years.add(entry.year);
    }
    for (const deal of deals) {
      if (deal.startDate) years.add(deal.startDate.getFullYear());
      if (deal.closedDate) years.add(deal.closedDate.getFullYear());
    }
    return {
      status: 200,
      body: {
        currentYear,
        years: Array.from(years).sort((a, b) => b - a),
        quarters: [1, 2, 3, 4]
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger12.error("Failed to fetch reporting periods", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/reporting/growthComparison.step.ts
import { logger as logger13 } from "motia";
var config13 = {
  name: "GrowthComparisonReport",
  description: "Returns side-by-side growth comparison analytics for reporting",
  triggers: [
    { type: "http", method: "GET", path: "/api/reporting/growth-comparison" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
function parseInteger(value, fallback) {
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function parseNumberList(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => parseInt(item.trim(), 10)).filter((item) => Number.isFinite(item));
}
function dedupeSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}
function buildSelection(prefix, params, defaults) {
  const mode = params[`${prefix}Mode`] === "quarter" ? "quarter" : "year";
  return {
    mode,
    year: parseInteger(params[`${prefix}Year`], defaults.year),
    quarter: parseInteger(params[`${prefix}Quarter`], defaults.quarter),
    years: dedupeSorted(parseNumberList(params[`${prefix}Years`])),
    quarters: dedupeSorted(parseNumberList(params[`${prefix}Quarters`]))
  };
}
function buildPeriods(selection) {
  if (selection.mode === "year") {
    const quarters = selection.quarters.length > 0 ? selection.quarters : [1, 2, 3, 4];
    return quarters.map((quarter) => ({ year: selection.year, quarter }));
  }
  const years = selection.years.length > 0 ? selection.years : [selection.year];
  return years.map((year) => ({ year, quarter: selection.quarter }));
}
function buildLabel(selection) {
  if (selection.mode === "year") {
    if (selection.quarters.length === 0 || selection.quarters.length === 4) {
      return `${selection.year} \xB7 All Quarters`;
    }
    return `${selection.year} \xB7 ${selection.quarters.map((quarter) => `Q${quarter}`).join(", ")}`;
  }
  const years = selection.years.length > 0 ? selection.years : [selection.year];
  return `Q${selection.quarter} \xB7 ${years.join(", ")}`;
}
function quarterBounds(year, quarter) {
  const start = new Date(year, (quarter - 1) * 3, 1);
  const end = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
  return { start, end };
}
function sortByValueDesc(items) {
  return items.sort((a, b) => b.value - a.value);
}
async function buildSnapshot(selection, scopedBdId) {
  const periods = buildPeriods(selection);
  const label = buildLabel(selection);
  const [closedWonStage, closedLostStage] = await Promise.all([
    prisma.pipelineStage.findFirst({ where: { name: "Closed Won" }, select: { id: true } }),
    prisma.pipelineStage.findFirst({ where: { name: "Closed Lost" }, select: { id: true } })
  ]);
  if (!closedWonStage || !closedLostStage) {
    throw new Error("Required pipeline stages were not found");
  }
  const serviceRevenue = /* @__PURE__ */ new Map();
  const accountRevenue = /* @__PURE__ */ new Map();
  const leadSourcePerformance = /* @__PURE__ */ new Map();
  const stageCycle = /* @__PURE__ */ new Map();
  let quota = 0;
  let actual = 0;
  let pipelineValue = 0;
  let openDeals = 0;
  let wins = 0;
  let losses = 0;
  let weightedCycleDays = 0;
  let sampleSize = 0;
  let longestCycleDays = null;
  let lostDeals = 0;
  let lostValue = 0;
  for (const period of periods) {
    const { start, end } = quarterBounds(period.year, period.quarter);
    const [periodTargets, closedWonDeals, closedLostDeals, openPipelineDeals, cycleDeals, auditLogs] = await Promise.all([
      prisma.target.findMany({
        where: {
          periodType: "QUARTERLY",
          date: { year: period.year, quarter: period.quarter },
          ...scopedBdId ? { bdId: scopedBdId } : {}
        },
        select: { quota: true }
      }),
      prisma.deal.findMany({
        where: {
          stageId: closedWonStage.id,
          isClosed: true,
          closedDate: { gte: start, lte: end },
          ...scopedBdId ? { bdId: scopedBdId } : {}
        },
        include: {
          client: { select: { accountType: true } },
          service: { select: { name: true } },
          bundle: { select: { name: true } }
        }
      }),
      prisma.deal.findMany({
        where: {
          stageId: closedLostStage.id,
          isClosed: true,
          closedDate: { gte: start, lte: end },
          ...scopedBdId ? { bdId: scopedBdId } : {}
        },
        select: {
          finalProposedValue: true,
          revenue: true,
          leadSource: true
        }
      }),
      prisma.deal.findMany({
        where: {
          startDate: { lte: end },
          OR: [
            { closedDate: null },
            { closedDate: { gt: end } }
          ],
          ...scopedBdId ? { bdId: scopedBdId } : {}
        },
        select: { revenue: true }
      }),
      prisma.deal.findMany({
        where: {
          isClosed: true,
          closedDate: { gte: start, lte: end },
          salesCycleDays: { not: null },
          ...scopedBdId ? { bdId: scopedBdId } : {}
        },
        select: { salesCycleDays: true }
      }),
      prisma.dealAuditLog.findMany({
        where: {
          exitedAt: { gte: start, lte: end },
          daysInStage: { not: null },
          deal: scopedBdId ? { bdId: scopedBdId } : void 0
        },
        include: {
          stage: { select: { name: true } }
        }
      })
    ]);
    quota += periodTargets.reduce((sum, item) => sum + Number(item.quota), 0);
    actual += closedWonDeals.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0);
    pipelineValue += openPipelineDeals.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0);
    openDeals += openPipelineDeals.length;
    wins += closedWonDeals.length;
    losses += closedLostDeals.length;
    lostDeals += closedLostDeals.length;
    lostValue += closedLostDeals.reduce((sum, item) => sum + Number(item.finalProposedValue ?? item.revenue ?? 0), 0);
    for (const item of closedWonDeals) {
      const serviceName = item.service?.name || item.bundle?.name || "Unassigned";
      const existingService = serviceRevenue.get(serviceName) || { name: serviceName, value: 0, deals: 0 };
      existingService.value += Number(item.revenue ?? 0);
      existingService.deals += 1;
      serviceRevenue.set(serviceName, existingService);
      const accountType = item.client.accountType || "Unassigned";
      const existingAccount = accountRevenue.get(accountType) || { name: accountType, value: 0, deals: 0 };
      existingAccount.value += Number(item.revenue ?? 0);
      existingAccount.deals += 1;
      accountRevenue.set(accountType, existingAccount);
      const sourceKey = item.leadSource || "UNKNOWN";
      const existingSource = leadSourcePerformance.get(sourceKey) || {
        source: sourceKey,
        value: 0,
        deals: 0,
        wins: 0,
        losses: 0,
        winRate: 0
      };
      existingSource.value += Number(item.revenue ?? 0);
      existingSource.deals += 1;
      existingSource.wins += 1;
      leadSourcePerformance.set(sourceKey, existingSource);
    }
    for (const item of closedLostDeals) {
      const sourceKey = item.leadSource || "UNKNOWN";
      const existingSource = leadSourcePerformance.get(sourceKey) || {
        source: sourceKey,
        value: 0,
        deals: 0,
        wins: 0,
        losses: 0,
        winRate: 0
      };
      existingSource.deals += 1;
      existingSource.losses += 1;
      leadSourcePerformance.set(sourceKey, existingSource);
    }
    sampleSize += cycleDeals.length;
    weightedCycleDays += cycleDeals.reduce((sum, item) => sum + Number(item.salesCycleDays ?? 0), 0);
    for (const item of cycleDeals) {
      const days = Number(item.salesCycleDays ?? 0);
      longestCycleDays = longestCycleDays === null ? days : Math.max(longestCycleDays, days);
    }
    for (const item of auditLogs) {
      const stageName = item.stage.name || "Unknown";
      const existing = stageCycle.get(stageName) || { totalDays: 0, count: 0 };
      existing.totalDays += Number(item.daysInStage ?? 0);
      existing.count += 1;
      stageCycle.set(stageName, existing);
    }
  }
  const finalLeadSource = Array.from(leadSourcePerformance.values()).map((item) => ({
    ...item,
    winRate: item.wins + item.losses > 0 ? item.wins / (item.wins + item.losses) * 100 : 0
  }));
  const finalStageCycle = Array.from(stageCycle.entries()).map(([stage, values]) => ({
    stage,
    avgDays: values.count > 0 ? values.totalDays / values.count : 0
  }));
  return {
    label,
    periods,
    quota,
    actual,
    attainmentPct: quota > 0 ? actual / quota * 100 : 0,
    pipelineValue,
    openDeals,
    wins,
    losses,
    winRate: wins + losses > 0 ? wins / (wins + losses) * 100 : 0,
    avgSalesCycleDays: sampleSize > 0 ? weightedCycleDays / sampleSize : null,
    longestCycleDays,
    sampleSize,
    lostDeals,
    lostValue,
    serviceRevenue: sortByValueDesc(Array.from(serviceRevenue.values())).slice(0, 6),
    accountRevenue: sortByValueDesc(Array.from(accountRevenue.values())).slice(0, 6),
    leadSourcePerformance: sortByValueDesc(finalLeadSource).slice(0, 6),
    stageCycle: finalStageCycle.sort((a, b) => b.avgDays - a.avgDays)
  };
}
var handler13 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const params = req.request.queryParams ?? {};
    const now = /* @__PURE__ */ new Date();
    const defaults = {
      year: now.getFullYear(),
      quarter: Math.floor(now.getMonth() / 3) + 1
    };
    const requestedBdId = params.bdId ? String(params.bdId) : null;
    const scopedBdId = user.role === "SALES_MANAGER" ? requestedBdId : user.id;
    const left = buildSelection("left", params, defaults);
    const right = buildSelection("right", params, {
      year: defaults.year - 1,
      quarter: defaults.quarter
    });
    const [leftSnapshot, rightSnapshot] = await Promise.all([
      buildSnapshot(left, scopedBdId),
      buildSnapshot(right, scopedBdId)
    ]);
    return {
      status: 200,
      body: {
        left: leftSnapshot,
        right: rightSnapshot
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger13.error("Failed to build growth comparison report", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/pipelineStages/list.step.ts
import { logger as logger14 } from "motia";
var config14 = {
  name: "ListPipelineStages",
  description: "Return all pipeline stages ordered by probability (used for stage picker in DealDetail)",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/pipeline-stages"
    }
  ],
  flows: ["sales-pipeline"]
};
var handler14 = async (req) => {
  try {
    await authenticate(req.request);
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { name: "asc" }
      // will be sorted by a fixed order on frontend
    });
    logger14.info("Pipeline stages fetched", { count: stages.length });
    return { status: 200, body: stages };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger14.error("Failed to fetch pipeline stages", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/payments/update.step.ts
import { logger as logger15 } from "motia";
import { z as z6 } from "zod";
import { Prisma as Prisma2 } from "@prisma/client";
var UpdatePaymentSchema = z6.object({
  amount: z6.number().positive("Amount must be greater than 0").optional(),
  billingYear: z6.number().int().min(2e3).max(2100).optional(),
  billingMonth: z6.number().int().min(1).max(12).optional()
});
var config15 = {
  name: "UpdatePayment",
  description: "Update an existing payment log",
  triggers: [
    { type: "http", method: "PATCH", path: "/api/payments/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler15 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can edit payment logs" } };
    }
    const parsed = UpdatePaymentSchema.safeParse(req.request.body);
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: "Validation failed", details: parsed.error.flatten() }
      };
    }
    const { id } = req.request.pathParams;
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
      return { status: 404, body: { error: "Payment not found" } };
    }
    const { amount, billingYear, billingMonth } = parsed.data;
    let resolvedDateId;
    if (billingYear && billingMonth) {
      const dateRow = await prisma.dateDimension.findFirst({
        where: { year: billingYear, month: billingMonth, day: 1 },
        select: { id: true }
      });
      if (!dateRow) {
        return { status: 400, body: { error: "Billing period not found in date dimension" } };
      }
      resolvedDateId = dateRow.id;
    }
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        ...amount !== void 0 ? { amount: new Prisma2.Decimal(amount) } : {},
        ...resolvedDateId ? { dateId: resolvedDateId } : {}
      },
      include: {
        deal: {
          select: {
            id: true,
            dealName: true,
            bdId: true,
            bd: { select: { firstName: true, lastName: true } },
            client: { select: { name: true } }
          }
        },
        date: { select: { year: true, month: true, quarter: true } }
      }
    });
    await createTeamNotification({
      dealId: updated.dealId,
      type: "FOLLOW_UP_DUE",
      triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
      content: `Payment log for "${updated.deal.dealName}" was updated${updated.date ? ` to ${updated.date.month}/${updated.date.year}` : ""}.`
    }).catch((error) => logger15.warn("Failed to create team payment-update notification", { error, paymentId: id }));
    return {
      status: 200,
      body: {
        id: updated.id,
        amount: Number(updated.amount),
        dealId: updated.dealId,
        deal: updated.deal,
        date: updated.date ?? null
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger15.error("Failed to update payment", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/payments/overview.step.ts
import { logger as logger16 } from "motia";
var config16 = {
  name: "PaymentsOverview",
  description: "Collections overview for the Payments page",
  triggers: [
    { type: "http", method: "GET", path: "/api/payments/overview" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler16 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const requestedBdId = req.request.queryParams?.bdId;
    const year = req.request.queryParams?.year ? Number(req.request.queryParams.year) : void 0;
    const quarter = req.request.queryParams?.quarter ? Number(req.request.queryParams.quarter) : void 0;
    if (requestedBdId && user.role !== "SALES_MANAGER" && requestedBdId !== user.id) {
      return { status: 403, body: { error: "You can only view your own collections overview" } };
    }
    const scopedBdId = user.role === "SALES_MANAGER" ? requestedBdId : user.id;
    const deals = await prisma.deal.findMany({
      where: {
        OR: [
          { stage: { name: "Closed Won" } },
          { isClosed: true }
        ],
        ...scopedBdId ? { bdId: scopedBdId } : {}
      },
      include: {
        bd: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true, accountType: true } },
        payments: {
          include: {
            date: { select: { year: true, month: true, quarter: true } }
          }
        }
      },
      orderBy: [{ closedDate: "desc" }, { dealName: "asc" }]
    });
    const overview = buildCollectionsOverview(
      deals.map((deal) => ({
        id: deal.id,
        dealName: deal.dealName,
        monthlySubscription: Number(deal.monthlySubscription || 0),
        revenue: Number(deal.revenue || 0),
        duration: deal.duration,
        startDate: deal.startDate,
        closedDate: deal.closedDate,
        terminatedAt: deal.terminatedAt,
        bdId: deal.bdId,
        bd: deal.bd,
        client: deal.client,
        payments: deal.payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          date: payment.date ?? null
        }))
      })),
      { year, quarter }
    );
    return { status: 200, body: overview };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger16.error("Failed to build payments overview", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/payments/list.step.ts
import { logger as logger17 } from "motia";
var config17 = {
  name: "ListPayments",
  description: "List payments with optional deal, BD, year, and quarter filters",
  triggers: [
    { type: "http", method: "GET", path: "/api/payments" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler17 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const dealId = req.request.queryParams?.dealId;
    const requestedBdId = req.request.queryParams?.bdId;
    const year = req.request.queryParams?.year ? Number(req.request.queryParams.year) : void 0;
    const quarter = req.request.queryParams?.quarter ? Number(req.request.queryParams.quarter) : void 0;
    if (requestedBdId && user.role !== "SALES_MANAGER" && requestedBdId !== user.id) {
      return { status: 403, body: { error: "You can only view your own payment logs" } };
    }
    const scopedBdId = user.role === "SALES_MANAGER" ? requestedBdId : user.id;
    const payments = await prisma.payment.findMany({
      where: {
        ...dealId ? { dealId } : {},
        ...scopedBdId ? { deal: { bdId: scopedBdId } } : {}
      },
      include: {
        deal: {
          select: {
            id: true,
            dealName: true,
            bdId: true,
            bd: { select: { id: true, firstName: true, lastName: true } },
            client: { select: { id: true, name: true, accountType: true } }
          }
        },
        date: { select: { year: true, month: true, quarter: true } }
      },
      orderBy: [{ date: { year: "desc" } }, { date: { month: "desc" } }]
    });
    const normalizedDeals = /* @__PURE__ */ new Map();
    for (const payment of payments) {
      if (!normalizedDeals.has(payment.deal.id)) {
        normalizedDeals.set(payment.deal.id, {
          id: payment.deal.id,
          dealName: payment.deal.dealName,
          monthlySubscription: 0,
          revenue: 0,
          duration: 0,
          startDate: null,
          bdId: payment.deal.bdId,
          bd: payment.deal.bd,
          client: payment.deal.client,
          payments: []
        });
      }
      normalizedDeals.get(payment.deal.id).payments.push({
        id: payment.id,
        amount: Number(payment.amount),
        date: payment.date ?? null
      });
    }
    const overview = buildCollectionsOverview(Array.from(normalizedDeals.values()), { year, quarter });
    const filteredLogs = overview.logs.filter((payment) => {
      if (dealId && payment.dealId !== dealId) return false;
      if (scopedBdId && payment.bdId !== scopedBdId) return false;
      if (year && payment.billingYear !== year) return false;
      if (quarter && payment.billingQuarter !== quarter) return false;
      return true;
    });
    return {
      status: 200,
      body: filteredLogs
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger17.error("Failed to list payments", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/payments/delete.step.ts
import { logger as logger18 } from "motia";
var config18 = {
  name: "DeletePayment",
  description: "Delete a payment log",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/payments/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler18 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can delete payment logs" } };
    }
    const { id } = req.request.pathParams;
    const existing = await prisma.payment.findUnique({
      where: { id },
      include: {
        deal: { select: { id: true, dealName: true } },
        date: { select: { year: true, month: true } }
      }
    });
    if (!existing) {
      return { status: 404, body: { error: "Payment not found" } };
    }
    await prisma.payment.delete({ where: { id } });
    await createTeamNotification({
      dealId: existing.dealId,
      type: "FOLLOW_UP_DUE",
      triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
      content: `Payment log for "${existing.deal.dealName}" was deleted${existing.date ? ` (${existing.date.month}/${existing.date.year})` : ""}.`
    }).catch((error) => logger18.warn("Failed to create team payment-delete notification", { error, paymentId: id }));
    return { status: 200, body: { success: true, id } };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger18.error("Failed to delete payment", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/payments/create.step.ts
import { logger as logger19 } from "motia";
import { z as z7 } from "zod";
import { Prisma as Prisma3 } from "@prisma/client";
var config19 = {
  name: "CreatePayment",
  description: "Record a payment against a deal",
  triggers: [
    { type: "http", method: "POST", path: "/api/payments" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var CreatePaymentSchema = z7.object({
  dealId: z7.string().uuid("Invalid deal ID"),
  amount: z7.number().positive("Amount must be greater than 0"),
  dateId: z7.string().uuid().optional(),
  billingYear: z7.number().int().min(2e3).max(2100).optional(),
  billingMonth: z7.number().int().min(1).max(12).optional()
});
var handler19 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const parsed = CreatePaymentSchema.safeParse(req.request.body);
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: "Validation failed", details: parsed.error.flatten() }
      };
    }
    const { dealId, amount, dateId, billingYear, billingMonth } = parsed.data;
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        stage: { select: { name: true } }
      }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (deal.stage.name !== "Closed Won" && !deal.isClosed) {
      return { status: 400, body: { error: "Payments can only be recorded against closed deals" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only record payments against your own deals" } };
    }
    let resolvedDateId = dateId;
    if (!resolvedDateId && billingYear && billingMonth) {
      const dateRow = await prisma.dateDimension.findFirst({
        where: {
          year: billingYear,
          month: billingMonth,
          day: 1
        },
        select: { id: true }
      });
      if (!dateRow) {
        return { status: 400, body: { error: "Billing period not found in date dimension" } };
      }
      resolvedDateId = dateRow.id;
    }
    const payment = await prisma.payment.create({
      data: {
        dealId,
        amount: new Prisma3.Decimal(amount),
        ...resolvedDateId ? { dateId: resolvedDateId } : {}
      },
      include: {
        deal: {
          select: {
            id: true,
            dealName: true,
            bdId: true,
            bd: { select: { firstName: true, lastName: true } },
            client: { select: { name: true } }
          }
        },
        date: { select: { year: true, month: true, quarter: true } }
      }
    });
    await createTeamNotification({
      dealId: payment.dealId,
      type: "FOLLOW_UP_DUE",
      triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
      content: `Payment of ${Number(payment.amount).toLocaleString("en-PH")} was logged for "${payment.deal.dealName}"${payment.date ? ` (${payment.date.month}/${payment.date.year})` : ""}.`
    }).catch((error) => logger19.warn("Failed to create team payment notification", { error, dealId }));
    return {
      status: 201,
      body: {
        id: payment.id,
        amount: Number(payment.amount),
        dealId: payment.dealId,
        deal: payment.deal,
        date: payment.date ?? null
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger19.error("Failed to create payment", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/markRead.step.ts
import { logger as logger20 } from "motia";
var config20 = {
  name: "MarkNotificationRead",
  description: "Mark a single notification as read",
  triggers: [
    // Path matches frontend: apiClient.patch(`/notifications/${id}/read`)
    { type: "http", method: "PATCH", path: "/notifications/:id/read" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler20 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return { status: 404, body: { error: "Notification not found" } };
    }
    if (notification.bdId !== user.id) {
      return { status: 403, body: { error: "Not your notification" } };
    }
    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    return { status: 200, body: { success: true } };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger20.error("Failed to mark notification read", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/markAllRead.step.ts
import { logger as logger21 } from "motia";
var config21 = {
  name: "MarkAllNotificationsRead",
  description: "Mark all of the authenticated user's notifications as read",
  triggers: [
    // Path matches frontend: apiClient.post('/notifications/read-all')
    { type: "http", method: "POST", path: "/notifications/read-all" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler21 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const result = await prisma.notification.updateMany({
      where: { bdId: user.id, isRead: false },
      data: { isRead: true }
    });
    return {
      status: 200,
      body: { success: true, updated: result.count }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger21.error("Failed to mark all notifications read", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/list.step.ts
import { logger as logger22 } from "motia";
var config22 = {
  name: "ListNotifications",
  description: "List notifications for the authenticated BD member with unread count (FR-ADD-010)",
  triggers: [
    // Path matches frontend api/notifications.ts: apiClient.get('/notifications')
    { type: "http", method: "GET", path: "/notifications" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler22 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const notifications = await prisma.notification.findMany({
      where: { bdId: user.id },
      include: {
        deal: { select: { id: true, dealName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const unreadCount = await prisma.notification.count({
      where: { bdId: user.id, isRead: false }
    });
    const TYPE_MAP = {
      STAGE_CHANGE: "StageChange",
      DEAL_STUCK: "DealStuck",
      ACTION_PLAN_DUE: "ActionPlanDue",
      FOLLOW_UP_DUE: "FollowUpDue",
      QUOTA_BEHIND_PACE: "QuotaAlert",
      NEW_DEAL_ASSIGNED: "NewDealAssigned",
      LOST_DEAL_FOLLOW_UP: "LostDealFollowUp"
    };
    const mapped = notifications.map((n) => ({
      id: n.id,
      content: n.content,
      type: TYPE_MAP[n.type] ?? n.type,
      is_read: n.isRead,
      triggered_by: n.triggeredBy,
      scheduled_at: n.scheduledAt?.toISOString() ?? null,
      created_at: n.createdAt.toISOString(),
      bd_id: n.bdId,
      deal_id: n.dealId ?? null,
      deal: n.deal ? { id: n.deal.id, deal_name: n.deal.dealName } : null
    }));
    return {
      status: 200,
      body: { notifications: mapped, unreadCount }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger22.error("Failed to list notifications", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/growthEntries/update.step.ts
import { logger as logger23 } from "motia";
import { z as z8 } from "zod";
import { Prisma as Prisma4 } from "@prisma/client";
var bodySchema2 = z8.object({
  label: z8.string().min(1).max(120).optional(),
  year: z8.number().int().min(2e3).max(2100).optional(),
  quarter: z8.number().int().min(1).max(4).nullable().optional(),
  revenue: z8.number().min(0).optional(),
  notes: z8.string().nullable().optional()
});
var config23 = {
  name: "UpdateGrowthEntry",
  description: "Update a growth table row",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/growth-entries/:id",
      bodySchema: bodySchema2
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler23 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const existing = await prisma.growthEntry.findUnique({ where: { id } });
    if (!existing) {
      return { status: 404, body: { error: "Growth entry not found" } };
    }
    if (user.role !== "SALES_MANAGER" && existing.ownerId !== user.id) {
      return { status: 403, body: { error: "You can only edit your own growth entries" } };
    }
    const updated = await prisma.growthEntry.update({
      where: { id },
      data: {
        ...req.request.body.label !== void 0 && { label: req.request.body.label },
        ...req.request.body.year !== void 0 && { year: req.request.body.year },
        ...req.request.body.quarter !== void 0 && { quarter: req.request.body.quarter },
        ...req.request.body.revenue !== void 0 && { revenue: new Prisma4.Decimal(req.request.body.revenue) },
        ...req.request.body.notes !== void 0 && { notes: req.request.body.notes }
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    return {
      status: 200,
      body: {
        ...updated,
        revenue: Number(updated.revenue)
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger23.error("Failed to update growth entry", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/growthEntries/list.step.ts
import { logger as logger24 } from "motia";
var config24 = {
  name: "ListGrowthEntries",
  description: "List growth table entries and a side-by-side comparison payload",
  triggers: [
    { type: "http", method: "GET", path: "/api/growth-entries" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler24 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const params = req.request.queryParams ?? {};
    const parsedYear = params.year ? parseInt(params.year, 10) : void 0;
    const parsedQuarter = params.quarter ? parseInt(params.quarter, 10) : void 0;
    const parsedCompareYear = params.compareYear ? parseInt(params.compareYear, 10) : void 0;
    const parsedCompareQuarter = params.compareQuarter ? parseInt(params.compareQuarter, 10) : void 0;
    const year = Number.isFinite(parsedYear) ? parsedYear : void 0;
    const quarter = Number.isFinite(parsedQuarter) ? parsedQuarter : void 0;
    const compareYear = Number.isFinite(parsedCompareYear) ? parsedCompareYear : void 0;
    const compareQuarter = Number.isFinite(parsedCompareQuarter) ? parsedCompareQuarter : void 0;
    const where = {
      ...user.role !== "SALES_MANAGER" ? { ownerId: user.id } : {},
      ...year ? { year } : {},
      ...quarter ? { quarter } : {}
    };
    const compareWhere = {
      ...user.role !== "SALES_MANAGER" ? { ownerId: user.id } : {},
      ...compareYear ? { year: compareYear } : {},
      ...compareQuarter ? { quarter: compareQuarter } : {}
    };
    const [entries, comparisonEntries] = await Promise.all([
      prisma.growthEntry.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: [{ year: "desc" }, { quarter: "desc" }, { label: "asc" }]
      }),
      compareYear ? prisma.growthEntry.findMany({
        where: compareWhere,
        orderBy: [{ label: "asc" }]
      }) : Promise.resolve([])
    ]);
    const leftMap = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      leftMap.set(entry.label, (leftMap.get(entry.label) ?? 0) + Number(entry.revenue));
    }
    const rightMap = /* @__PURE__ */ new Map();
    for (const entry of comparisonEntries) {
      rightMap.set(entry.label, (rightMap.get(entry.label) ?? 0) + Number(entry.revenue));
    }
    const labels = Array.from(/* @__PURE__ */ new Set([...leftMap.keys(), ...rightMap.keys()])).sort();
    const comparison = labels.map((label) => {
      const leftRevenue = leftMap.get(label) ?? 0;
      const rightRevenue = rightMap.get(label) ?? 0;
      const delta = leftRevenue - rightRevenue;
      const growthPct = rightRevenue === 0 ? null : delta / rightRevenue * 100;
      return { label, leftRevenue, rightRevenue, delta, growthPct };
    });
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
          updatedAt: entry.updatedAt
        })),
        comparison
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger24.error("Failed to list growth entries", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/growthEntries/create.step.ts
import { logger as logger25 } from "motia";
import { z as z9 } from "zod";
import { Prisma as Prisma5 } from "@prisma/client";
var bodySchema3 = z9.object({
  label: z9.string().min(1).max(120),
  year: z9.number().int().min(2e3).max(2100),
  quarter: z9.number().int().min(1).max(4).optional(),
  revenue: z9.number().min(0),
  notes: z9.string().optional()
});
var config25 = {
  name: "CreateGrowthEntry",
  description: "Create a growth table row",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/growth-entries",
      bodySchema: bodySchema3
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler25 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { label, year, quarter, revenue, notes } = req.request.body;
    const entry = await prisma.growthEntry.create({
      data: {
        label,
        year,
        quarter: quarter ?? null,
        revenue: new Prisma5.Decimal(revenue),
        notes,
        ownerId: user.id
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    return {
      status: 201,
      body: {
        ...entry,
        revenue: Number(entry.revenue)
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger25.error("Failed to create growth entry", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/updateStage.step.ts
import { logger as logger26, enqueue } from "motia";
import { z as z10 } from "zod";
import { Prisma as Prisma6 } from "@prisma/client";
var config26 = {
  name: "UpdateDealStage",
  description: "Move a deal to a new pipeline stage with atomic audit log tracking (FR-D07 to FR-D11)",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/deals/:id/stage",
      bodySchema: z10.object({
        stageId: z10.string().uuid(),
        remarks: z10.string().min(1, "Remarks are required when moving a deal"),
        actionPlan: z10.string().min(1, "Action plan is required when moving a deal"),
        actionPlanDueDate: z10.string().datetime().optional(),
        notes: z10.string().optional()
      })
    }
  ],
  enqueues: ["deal.stage.changed"],
  flows: ["sales-pipeline"]
};
var handler26 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const { stageId, remarks, actionPlan, actionPlanDueDate, notes } = req.request.body;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only manage your own deals" } };
    }
    if (deal.contractStatus === "TERMINATED") {
      return { status: 400, body: { error: "Terminated contracts cannot move through the pipeline." } };
    }
    if (deal.stageId === stageId) {
      return { status: 200, body: { message: "Deal is already at this stage" } };
    }
    const targetStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId }
    });
    if (!targetStage) {
      return { status: 400, body: { error: "Target stage not found \u2014 check stageId" } };
    }
    if (targetStage.name === "Closed Lost" && !remarks.trim()) {
      return {
        status: 400,
        body: {
          error: "Remarks must explain why the deal was lost before moving to Closed Lost."
        }
      };
    }
    if (targetStage.name === "Closed Won" && !deal.contractLink) {
      return {
        status: 400,
        body: {
          error: "A contract link must be attached to the deal before marking it as Closed Won."
        }
      };
    }
    const now = /* @__PURE__ */ new Date();
    const isClosed = ["Closed Won", "Closed Lost"].includes(targetStage.name);
    const salesCycleDays = isClosed && deal.startDate ? Math.max(
      0,
      Math.floor((now.getTime() - deal.startDate.getTime()) / 864e5)
    ) : null;
    const updatedDeal = await prisma.$transaction(async (tx) => {
      await tx.dealAuditLog.updateMany({
        where: { dealId: id, exitedAt: null },
        data: { exitedAt: now }
      });
      await tx.dealAuditLog.create({
        data: {
          dealId: id,
          stageId,
          changedById: user.id,
          enteredAt: now,
          notes: notes || `Moved from ${deal.stage.name} to ${targetStage.name}`,
          remarks,
          actionPlan,
          actionPlanDueDate: actionPlanDueDate ? new Date(actionPlanDueDate) : null
        }
      });
      const dealUpdateData = {
        stage: { connect: { id: stageId } },
        lastStageUpdateAt: now,
        isClosed,
        ...isClosed ? {
          closedDate: now,
          ...salesCycleDays !== null && { salesCycleDays }
        } : {
          closedDate: null,
          salesCycleDays: null
        },
        // Capture final proposed value on Closed Lost (FR-ADD-005)
        ...targetStage.name === "Closed Lost" && {
          finalProposedValue: deal.revenue
        }
      };
      const updated = await tx.deal.update({
        where: { id },
        data: dealUpdateData,
        include: {
          stage: true,
          bd: { select: { id: true, firstName: true, lastName: true } },
          client: true,
          service: true,
          bundle: true,
          auditLogs: {
            where: { exitedAt: null },
            take: 1,
            orderBy: { enteredAt: "desc" }
          }
        }
      });
      return updated;
    });
    await enqueue({
      topic: "deal.stage.changed",
      data: {
        dealId: id,
        dealName: deal.dealName,
        previousStageId: deal.stageId,
        previousStageName: deal.stage.name,
        newStageId: stageId,
        newStageName: targetStage.name,
        bdId: deal.bdId,
        changedById: user.id,
        isClosed
      }
    });
    logger26.info("Deal stage updated", {
      dealId: id,
      from: deal.stage.name,
      to: targetStage.name,
      by: user.id
    });
    return { status: 200, body: updatedDeal };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma6.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Record not found or invalid reference" } };
    }
    logger26.error("Failed to update deal stage", {
      error: error.message,
      dealId: req.request.pathParams.id
    });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/update.step.ts
import { logger as logger27 } from "motia";
import { z as z11 } from "zod";
import { Prisma as Prisma7 } from "@prisma/client";
var config27 = {
  name: "UpdateDeal",
  description: "Update an existing deal (fields only \u2014 stage transitions go through /stage endpoint)",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/deals/:id",
      bodySchema: z11.object({
        dealName: z11.string().min(1).optional(),
        monthlySubscription: z11.number().min(0).optional(),
        duration: z11.number().min(1).optional(),
        stageId: z11.string().uuid().optional(),
        startDate: z11.string().datetime().optional(),
        // remarks/actionPlan now live on DealAuditLog (Rev 1–2)
        // These update the CURRENT open audit log entry (exitedAt IS NULL)
        remarks: z11.string().optional(),
        actionPlan: z11.string().optional(),
        actionPlanDueDate: z11.string().datetime().optional(),
        dueDate: z11.string().datetime().optional(),
        proposalLink: z11.string().url().optional(),
        contractLink: z11.string().url().optional(),
        primaryContactId: z11.string().uuid().nullable().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler27 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const {
      stageId,
      remarks,
      actionPlan,
      actionPlanDueDate,
      monthlySubscription,
      duration,
      primaryContactId,
      ...rest
    } = req.request.body;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only manage your own deals" } };
    }
    if (deal.contractStatus === "TERMINATED" && stageId && stageId !== deal.stageId) {
      return { status: 400, body: { error: "Terminated contracts cannot move through the pipeline." } };
    }
    let targetStageName = "";
    if (stageId && stageId !== deal.stageId) {
      const targetStage = await prisma.pipelineStage.findUnique({
        where: { id: stageId }
      });
      if (!targetStage) {
        return { status: 400, body: { error: "Target stage not found \u2014 check stageId" } };
      }
      targetStageName = targetStage.name;
    }
    if (targetStageName === "Closed Lost" && !remarks) {
      const currentLog = await prisma.dealAuditLog.findFirst({
        where: { dealId: id, exitedAt: null },
        orderBy: { enteredAt: "desc" }
      });
      if (!currentLog?.remarks) {
        return {
          status: 400,
          body: { error: "Remarks (Loss Reason) are required when closing a deal as lost" }
        };
      }
    }
    if (primaryContactId !== void 0 && primaryContactId !== null) {
      const selectedContact = await prisma.contact.findFirst({
        where: { id: primaryContactId, clientId: deal.clientId },
        select: { id: true }
      });
      if (!selectedContact) {
        return { status: 400, body: { error: "Selected primary contact does not belong to this deal client." } };
      }
    }
    const updateData = { ...rest };
    if (monthlySubscription !== void 0 || duration !== void 0) {
      const newMonthly = monthlySubscription ?? Number(deal.monthlySubscription);
      const newDuration = duration ?? deal.duration;
      updateData.monthlySubscription = newMonthly;
      updateData.duration = newDuration;
      updateData.revenue = newMonthly * newDuration;
    }
    if (stageId && stageId !== deal.stageId) {
      const now = /* @__PURE__ */ new Date();
      updateData.stageId = stageId;
      updateData.lastStageUpdateAt = now;
      if (targetStageName === "Closed Won" || targetStageName === "Closed Lost") {
        updateData.isClosed = true;
        updateData.closedDate = now;
        if (deal.startDate) {
          updateData.salesCycleDays = Math.max(
            0,
            Math.floor((now.getTime() - deal.startDate.getTime()) / 864e5)
          );
        }
      } else {
        updateData.isClosed = false;
        updateData.closedDate = null;
        updateData.salesCycleDays = null;
      }
    }
    const updatedDeal = await prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: updateData,
        include: {
          stage: true,
          client: true,
          bd: {
            select: { id: true, firstName: true, lastName: true }
          },
          dealContacts: {
            include: {
              contact: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  number: true,
                  designation: true
                }
              }
            },
            orderBy: { isPrimary: "desc" }
          },
          auditLogs: {
            where: { exitedAt: null },
            take: 1,
            orderBy: { enteredAt: "desc" }
          }
        }
      });
      if (remarks !== void 0 || actionPlan !== void 0 || actionPlanDueDate !== void 0) {
        await tx.dealAuditLog.updateMany({
          where: { dealId: id, exitedAt: null },
          data: {
            ...remarks !== void 0 && { remarks },
            ...actionPlan !== void 0 && { actionPlan },
            ...actionPlanDueDate !== void 0 && {
              actionPlanDueDate: new Date(actionPlanDueDate)
            }
          }
        });
      }
      if (primaryContactId !== void 0) {
        await tx.dealContact.updateMany({
          where: { dealId: id },
          data: { isPrimary: false }
        });
        if (primaryContactId !== null) {
          const existingDealContact = await tx.dealContact.findFirst({
            where: { dealId: id, contactId: primaryContactId },
            select: { id: true }
          });
          if (existingDealContact) {
            await tx.dealContact.update({
              where: { id: existingDealContact.id },
              data: { isPrimary: true }
            });
          } else {
            await tx.dealContact.create({
              data: {
                dealId: id,
                contactId: primaryContactId,
                isPrimary: true
              }
            });
          }
        }
      }
      if (stageId && stageId !== deal.stageId) {
        await tx.dealAuditLog.updateMany({
          where: { dealId: id, exitedAt: null },
          data: { exitedAt: /* @__PURE__ */ new Date() }
        });
        await tx.dealAuditLog.create({
          data: {
            dealId: id,
            stageId,
            changedById: user.id,
            enteredAt: /* @__PURE__ */ new Date(),
            notes: `Moved from ${deal.stage.name} to ${targetStageName}`,
            remarks,
            actionPlan,
            actionPlanDueDate: actionPlanDueDate ? new Date(actionPlanDueDate) : null
          }
        });
      }
      return updated;
    });
    logger27.info("Updated deal", { dealId: id, by: user.id });
    const activityChanges = [];
    if (remarks !== void 0) activityChanges.push("remarks");
    if (actionPlan !== void 0) activityChanges.push("action plan");
    if (actionPlanDueDate !== void 0) activityChanges.push("action plan due date");
    if (req.request.body.dueDate !== void 0) activityChanges.push("contract end date");
    if (primaryContactId !== void 0) activityChanges.push("primary contact");
    if (activityChanges.length > 0) {
      const content = `Deal "${updatedDeal.dealName}" follow-up details were updated: ${activityChanges.join(", ")}.`;
      await createTeamNotification({
        dealId: updatedDeal.id,
        type: "FOLLOW_UP_DUE",
        triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
        content: `${content} Updated by ${user.firstName} ${user.lastName}.`
      }).catch((error) => logger27.warn("Failed to create deal activity notification", { error, dealId: id }));
    }
    return {
      status: 200,
      body: updatedDeal
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma7.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Record not found or invalid ID provided" } };
    }
    logger27.error("Failed to update deal", { error: error.message, dealId: req.request.pathParams.id });
    return {
      status: 500,
      body: { error: "Internal server error" }
    };
  }
};

// steps/api/deals/terminate.step.ts
import { logger as logger28 } from "motia";
import { z as z12 } from "zod";
var config28 = {
  name: "TerminateDealContract",
  description: "Terminate an active closed-won contract early and log the activity",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/deals/:id/terminate",
      bodySchema: z12.object({
        terminatedAt: z12.string().datetime(),
        reason: z12.string().min(1),
        notes: z12.string().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler28 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const { terminatedAt, reason, notes } = req.request.body;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only manage your own deals" } };
    }
    if (deal.stage.name !== "Closed Won") {
      return { status: 400, body: { error: "Only closed-won deals can be terminated as active contracts." } };
    }
    if (deal.contractStatus === "TERMINATED") {
      return { status: 400, body: { error: "This contract is already terminated." } };
    }
    const effectiveTerminationDate = new Date(terminatedAt);
    if (deal.startDate && effectiveTerminationDate < deal.startDate) {
      return { status: 400, body: { error: "Termination date cannot be before the contract start date." } };
    }
    const updatedDeal = await prisma.$transaction(async (tx) => {
      await tx.dealActivity.create({
        data: {
          dealId: id,
          type: "CONTRACT_TERMINATED",
          title: "Contract terminated early",
          description: [
            `Reason: ${reason}`,
            notes?.trim() ? `Notes: ${notes.trim()}` : null
          ].filter(Boolean).join("\n"),
          effectiveDate: effectiveTerminationDate,
          createdById: user.id
        }
      });
      return tx.deal.update({
        where: { id },
        data: {
          contractStatus: "TERMINATED",
          terminatedAt: effectiveTerminationDate,
          terminationReason: reason.trim(),
          terminationNotes: notes?.trim() || null,
          terminatedById: user.id
        },
        include: {
          stage: true,
          bd: { select: { id: true, firstName: true, lastName: true } },
          client: true,
          service: true,
          bundle: true,
          auditLogs: {
            where: { exitedAt: null },
            take: 1,
            orderBy: { enteredAt: "desc" }
          }
        }
      });
    });
    logger28.info("Terminated contract", { dealId: id, by: user.id });
    await createTeamNotification({
      dealId: updatedDeal.id,
      type: "FOLLOW_UP_DUE",
      triggeredBy: "NO_FOLLOW_UP_IN_14_DAYS",
      content: `Contract for "${updatedDeal.dealName}" was terminated effective ${effectiveTerminationDate.toLocaleDateString("en-PH")}. Review collections and account follow-up.`
    }).catch((error) => logger28.warn("Failed to create termination notification", { error, dealId: id }));
    return { status: 200, body: updatedDeal };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger28.error("Failed to terminate contract", {
      error: error.message,
      dealId: req.request.pathParams.id
    });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/list.step.ts
import { logger as logger29 } from "motia";
import { Prisma as Prisma8 } from "@prisma/client";
var currentAuditLogSelect = Prisma8.validator()({
  id: true,
  enteredAt: true,
  remarks: true,
  actionPlan: true,
  actionPlanDueDate: true
});
var config29 = {
  name: "ListDeals",
  description: "Get list of all deals",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler29 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    logger29.info("Listing deals", { userId: user.id });
    const whereClause = user.role === "SALES_MANAGER" ? {} : { bdId: user.id };
    const deals = await prisma.deal.findMany({
      where: whereClause,
      include: {
        stage: true,
        // pipeline stage info
        bd: { select: { id: true, firstName: true, lastName: true } },
        client: {
          select: {
            id: true,
            name: true,
            accountType: true,
            contact: {
              // This is how you get the Client's Primary Contact
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        service: true,
        bundle: true,
        // Current stage audit log for remarks/actionPlanDueDate (Rev 1–3)
        auditLogs: {
          where: { exitedAt: null },
          take: 1,
          orderBy: { enteredAt: "desc" },
          select: currentAuditLogSelect
        },
        _count: {
          select: {
            auditLogs: true,
            dealContacts: true
          }
        }
      },
      orderBy: { startDate: "desc" }
    });
    return { status: 200, body: deals };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger29.error("Failed to list deals", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/history.step.ts
import { logger as logger30 } from "motia";
var config30 = {
  name: "GetDealHistory",
  description: "Get full stage transition history for a deal (FR-ADD-002)",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals/:id/history" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler30 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, bdId: true }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only view your own deals" } };
    }
    const history = await prisma.dealAuditLog.findMany({
      where: { dealId: id },
      include: {
        stage: { select: { id: true, name: true } },
        changedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { enteredAt: "desc" }
    });
    const activities = await prisma.dealActivity.findMany({
      where: { dealId: id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const stageEntries = history.map((entry) => {
      const exitTime = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now();
      const enterTime = new Date(entry.enteredAt).getTime();
      const daysInStage = Math.floor((exitTime - enterTime) / 864e5);
      return {
        id: entry.id,
        type: "stage_change",
        title: entry.stage.name,
        stage: entry.stage.name,
        stageId: entry.stageId,
        enteredAt: entry.enteredAt,
        exitedAt: entry.exitedAt,
        daysInStage,
        isCurrent: entry.exitedAt === null,
        changedById: entry.changedById,
        changedBy: entry.changedBy,
        notes: entry.notes
      };
    });
    const activityEntries = activities.map((entry) => ({
      id: entry.id,
      type: entry.type === "CONTRACT_TERMINATED" ? "contract_terminated" : "stage_change",
      title: entry.title,
      enteredAt: entry.createdAt,
      effectiveDate: entry.effectiveDate,
      changedById: entry.createdById,
      changedBy: entry.createdBy,
      notes: entry.description,
      isCurrent: false
    }));
    const enriched = [...stageEntries, ...activityEntries].sort(
      (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime()
    );
    return { status: 200, body: enriched };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger30.error("Failed to get deal history", { error: error.message, dealId: req.request.pathParams.id });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/get.step.ts
import { logger as logger31 } from "motia";
import { Prisma as Prisma9 } from "@prisma/client";
var currentAuditLogSelect2 = Prisma9.validator()({
  id: true,
  enteredAt: true,
  remarks: true,
  actionPlan: true,
  actionPlanDueDate: true,
  notes: true,
  changedBy: {
    select: { id: true, firstName: true, lastName: true }
  }
});
var config31 = {
  name: "GetDeal",
  description: "Get a single deal by ID with full details (supports DealDetail page)",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler31 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
        bd: { select: { id: true, firstName: true, lastName: true } },
        client: {
          select: {
            id: true,
            name: true,
            brand: true,
            accountType: true,
            status: true,
            industryId: true,
            contactId: true,
            contact: {
              select: { id: true, firstName: true, lastName: true }
            },
            contacts: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                number: true,
                designation: true,
                decisionRank: true,
                isPrimary: true,
                clientId: true
              },
              orderBy: [
                { isPrimary: "desc" },
                { lastName: "asc" },
                { firstName: "asc" }
              ]
            }
          }
        },
        service: true,
        bundle: {
          include: {
            bundleServices: {
              include: {
                service: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    isActive: true
                  }
                }
              },
              orderBy: { name: "asc" }
            }
          }
        },
        projection: true,
        dealContacts: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                number: true,
                designation: true
              }
            }
          },
          orderBy: { isPrimary: "desc" }
        },
        // Current stage audit log — provides remarks/actionPlan (Rev 1–3)
        auditLogs: {
          where: { exitedAt: null },
          take: 1,
          orderBy: { enteredAt: "desc" },
          select: currentAuditLogSelect2
        },
        _count: {
          select: { auditLogs: true, dealContacts: true }
        }
      }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
    }
    if (user.role !== "SALES_MANAGER" && deal.bdId !== user.id) {
      return { status: 403, body: { error: "You can only view your own deals" } };
    }
    return { status: 200, body: deal };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger31.error("Failed to get deal", { error: error.message, dealId: req.request.pathParams.id });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/create.step.ts
import { logger as logger32, enqueue as enqueue2 } from "motia";
import { z as z13 } from "zod";
import { Prisma as Prisma10 } from "@prisma/client";
var config32 = {
  name: "CreateDeal",
  description: "Create a new deal",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/deals",
      bodySchema: z13.object({
        dealName: z13.string().min(1),
        clientId: z13.string().min(1),
        monthlySubscription: z13.number().min(0),
        duration: z13.number().min(1),
        leadSource: z13.enum(["INBOUND", "OUTBOUND", "REFERRAL"]),
        contractStartDate: z13.string().min(1),
        contractEndDate: z13.string().min(1),
        primaryContactId: z13.string().uuid().optional(),
        serviceId: z13.string().optional(),
        bundleId: z13.string().optional(),
        proposalLink: z13.string().optional(),
        contractLink: z13.string().optional()
      }).refine(
        (body) => Boolean(body.serviceId || body.bundleId),
        {
          message: "A deal must be tied to a service or bundle.",
          path: ["serviceId"]
        }
      )
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler32 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const {
      dealName,
      clientId,
      monthlySubscription,
      duration,
      leadSource,
      contractStartDate,
      contractEndDate,
      primaryContactId,
      serviceId,
      bundleId,
      proposalLink,
      contractLink
    } = req.request.body;
    const inquiryStage = await prisma.pipelineStage.findUnique({
      where: { name: "Inquiry" }
    });
    if (!inquiryStage) {
      return { status: 500, body: { error: "Inquiry stage not found in DB." } };
    }
    if (primaryContactId) {
      const selectedContact = await prisma.contact.findFirst({
        where: { id: primaryContactId, clientId },
        select: { id: true }
      });
      if (!selectedContact) {
        return { status: 400, body: { error: "Selected primary contact does not belong to this client." } };
      }
    }
    const newDeal = await prisma.deal.create({
      data: {
        dealName,
        clientId,
        bdId: user.id,
        // assign strictly to current user
        monthlySubscription,
        revenue: monthlySubscription * duration,
        duration,
        stageId: inquiryStage.id,
        leadSource,
        serviceId,
        bundleId,
        proposalLink,
        contractLink,
        startDate: new Date(contractStartDate),
        dueDate: new Date(contractEndDate),
        lastStageUpdateAt: /* @__PURE__ */ new Date(),
        ...primaryContactId && {
          dealContacts: {
            create: {
              contactId: primaryContactId,
              isPrimary: true
            }
          }
        },
        auditLogs: {
          create: {
            stageId: inquiryStage.id,
            changedById: user.id,
            enteredAt: /* @__PURE__ */ new Date(),
            notes: "Initial inquiry created"
          }
        }
      },
      include: {
        client: true,
        stage: true,
        bd: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        service: true,
        bundle: true,
        dealContacts: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                number: true,
                designation: true
              }
            }
          },
          orderBy: { isPrimary: "desc" }
        },
        auditLogs: {
          where: { exitedAt: null },
          take: 1,
          orderBy: { enteredAt: "desc" },
          select: {
            id: true,
            enteredAt: true,
            remarks: true,
            actionPlan: true,
            actionPlanDueDate: true,
            notes: true
          }
        }
      }
    });
    logger32.info("Created new deal", { dealId: newDeal.id, bdId: user.id });
    await enqueue2({
      topic: "deal.created",
      data: {
        dealId: newDeal.id,
        dealName: newDeal.dealName,
        bdId: newDeal.bdId,
        stageId: newDeal.stageId,
        revenue: newDeal.revenue,
        expectedCloseDate: newDeal.dueDate ?? newDeal.startDate
      }
    });
    await createTeamNotification({
      dealId: newDeal.id,
      type: "NEW_DEAL_ASSIGNED",
      triggeredBy: "STAGE_CHANGE",
      content: `New deal "${newDeal.dealName}" was created and assigned to ${newDeal.bd.firstName} ${newDeal.bd.lastName}.`
    }).catch((error) => logger32.warn("Failed to create direct new-deal notification", { error }));
    return {
      status: 201,
      body: {
        ...newDeal,
        stage_name: newDeal.stage.name,
        days_in_stage: 0
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma10.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        status: 400,
        body: { error: "Related record not found \u2014 check bdMemberId, clientId, serviceIds, etc." }
      };
    }
    logger32.error("Failed to create deal", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/dashboard/executive.step.ts
import { logger as logger33 } from "motia";
var config33 = {
  name: "ExecutiveDashboard",
  description: "Returns all 9 executive-level dashboard metrics (Manager only)",
  triggers: [
    { type: "http", method: "GET", path: "/api/dashboard/executive" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler33 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Forbidden: Manager access only" } };
    }
    const { queryParams } = req.request;
    const now = /* @__PURE__ */ new Date();
    const year = queryParams?.year ? parseInt(queryParams.year, 10) : now.getFullYear();
    const quarter = queryParams?.quarter ? parseInt(queryParams.quarter, 10) : Math.floor(now.getMonth() / 3) + 1;
    const qStart = new Date(year, (quarter - 1) * 3, 1);
    const qEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
    const closedWonStage = await prisma.pipelineStage.findFirst({
      where: { name: "Closed Won" }
    });
    if (!closedWonStage) {
      return { status: 500, body: { error: "Closed Won stage not found" } };
    }
    const closedWonDeals = await prisma.deal.findMany({
      where: {
        stageId: closedWonStage.id,
        isClosed: true,
        closedDate: { gte: qStart, lte: qEnd }
      }
    });
    const teamActual = closedWonDeals.reduce(
      (sum, d) => sum + Number(d.revenue ?? 0),
      0
    );
    const allTargets = await prisma.target.findMany({
      where: {
        periodType: "QUARTERLY",
        date: { year, quarter }
      }
    });
    const teamQuota = allTargets.reduce((sum, t) => sum + Number(t.quota), 0);
    const negotiationStage = await prisma.pipelineStage.findFirst({
      where: { name: "Negotiation" }
    });
    const negotiationDeals = negotiationStage ? await prisma.deal.findMany({
      where: { stageId: negotiationStage.id, isClosed: false }
    }) : [];
    const negotiationRevenue = negotiationDeals.reduce(
      (sum, d) => sum + Number(d.revenue ?? 0),
      0
    );
    const teamForecast = teamActual + 0.8 * negotiationRevenue;
    const attainment = teamQuota > 0 ? Math.round(teamActual / teamQuota * 100 * 10) / 10 : 0;
    const pipelineByStage = await prisma.$queryRaw`
            SELECT ps.name AS stage,
                   COUNT(d.id)::int AS count,
                   COALESCE(SUM(d.revenue), 0)::float AS value
            FROM deal d
            JOIN pipeline_stage ps ON d.stage_id = ps.id
            WHERE d.is_closed = false
            GROUP BY ps.name
            ORDER BY ps.name
        `;
    const stagesWithDuration = await prisma.pipelineStage.findMany({
      where: { duration: { not: null } }
    });
    const stuckDeals = [];
    for (const stage of stagesWithDuration) {
      const threshold = stage.duration;
      const cutoff = new Date(now.getTime() - threshold * 24 * 60 * 60 * 1e3);
      const stuck = await prisma.deal.findMany({
        where: {
          stageId: stage.id,
          isClosed: false,
          startDate: { lte: cutoff }
        },
        include: {
          bd: { select: { firstName: true, lastName: true } }
        }
      });
      for (const d of stuck) {
        const daysStuck = d.startDate ? Math.floor(
          (now.getTime() - d.startDate.getTime()) / (1e3 * 60 * 60 * 24)
        ) : 0;
        stuckDeals.push({
          id: d.id,
          dealName: d.dealName,
          stage: stage.name,
          bdName: `${d.bd.firstName} ${d.bd.lastName}`,
          daysStuck
        });
      }
    }
    stuckDeals.sort((a, b) => b.daysStuck - a.daysStuck);
    const leaderboard = await prisma.$queryRaw`
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
        `;
    const dealsByAccountType = await prisma.$queryRaw`
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
        `;
    const servicePerformance = await prisma.$queryRaw`
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
        `;
    const clientRevRanking = await prisma.$queryRaw`
            SELECT c.id AS "clientId",
                   c.name AS "clientName",
                   c.account_type AS "accountType",
                   COUNT(d.id)::int AS "dealCount",
                   COALESCE(SUM(d.revenue), 0)::float AS revenue
            FROM deal d
            JOIN client c ON d.client_id = c.id
            WHERE d.stage_id = ${closedWonStage.id}
              AND d.closed_date >= ${qStart}
              AND d.closed_date <= ${qEnd}
            GROUP BY c.id, c.name, c.account_type
            ORDER BY revenue DESC
            LIMIT 10
        `;
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
          clientRevRanking
        }
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger33.error("Executive dashboard failed", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/dashboard/bd.step.ts
import { logger as logger34 } from "motia";
var config34 = {
  name: "BDDashboard",
  description: "Returns all 10 BD-level dashboard metrics for a given quarter/year",
  triggers: [
    { type: "http", method: "GET", path: "/api/dashboard/bd" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler34 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { queryParams } = req.request;
    const bdId = user.role === "SALES_MANAGER" && queryParams?.bdId ? queryParams.bdId : user.id;
    const now = /* @__PURE__ */ new Date();
    const year = queryParams?.year ? parseInt(queryParams.year, 10) : now.getFullYear();
    const quarter = queryParams?.quarter ? parseInt(queryParams.quarter, 10) : Math.floor(now.getMonth() / 3) + 1;
    const qStart = new Date(year, (quarter - 1) * 3, 1);
    const qEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
    const closedWonStage = await prisma.pipelineStage.findFirst({
      where: { name: "Closed Won" }
    });
    if (!closedWonStage) {
      return { status: 500, body: { error: "Closed Won stage not found" } };
    }
    const closedWonDeals = await prisma.deal.findMany({
      where: {
        bdId,
        stageId: closedWonStage.id,
        isClosed: true,
        closedDate: { gte: qStart, lte: qEnd }
      }
    });
    const dealsClosed = closedWonDeals.length;
    const closedRevenue = closedWonDeals.reduce(
      (sum, d) => sum + Number(d.revenue ?? 0),
      0
    );
    const openDealsRaw = await prisma.deal.findMany({
      where: { bdId, isClosed: false },
      include: {
        stage: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, accountType: true } }
      },
      orderBy: { startDate: "asc" }
      // oldest first = most stale
    });
    const openPipelineCount = openDealsRaw.length;
    const openPipelineValue = openDealsRaw.reduce(
      (sum, d) => sum + Number(d.revenue ?? 0),
      0
    );
    const targetRecord = await prisma.target.findFirst({
      where: {
        bdId,
        periodType: "QUARTERLY",
        date: { year, quarter }
      }
    });
    const quarterlyTarget = Number(targetRecord?.quota ?? 0);
    const quotaAttainment = quarterlyTarget > 0 ? Math.round(closedRevenue / quarterlyTarget * 100 * 10) / 10 : 0;
    const negotiationStage = await prisma.pipelineStage.findFirst({
      where: { name: "Negotiation" }
    });
    const negotiationRevenue = negotiationStage ? openDealsRaw.filter((d) => d.stage.name === "Negotiation").reduce((sum, d) => sum + Number(d.revenue ?? 0), 0) : 0;
    const salesForecast = closedRevenue + 0.8 * negotiationRevenue;
    const salesVariance = quarterlyTarget - closedRevenue;
    const monthsElapsed = now.getFullYear() === year && Math.floor(now.getMonth() / 3) + 1 === quarter ? now.getMonth() - (quarter - 1) * 3 + 1 : 3;
    const expectedByNow = quarterlyTarget > 0 ? quarterlyTarget / 3 * monthsElapsed : 0;
    const monthlyExcessDeficit = closedRevenue - expectedByNow;
    const quarterlyExcessDeficit = closedRevenue - quarterlyTarget;
    const pipelineByStage = await prisma.$queryRaw`
            SELECT ps.name AS stage,
                   COUNT(d.id)::int AS count,
                   COALESCE(SUM(d.revenue), 0)::float AS value
            FROM deal d
            JOIN pipeline_stage ps ON d.stage_id = ps.id
            WHERE d.bd_id = ${bdId} AND d.is_closed = false
            GROUP BY ps.name
            ORDER BY ps.name
        `;
    const openDeals = openDealsRaw.map((d) => ({
      id: d.id,
      dealName: d.dealName,
      revenue: Number(d.revenue ?? 0),
      startDate: d.startDate?.toISOString() ?? null,
      stage: d.stage.name,
      client: {
        id: d.client.id,
        name: d.client.name,
        accountType: d.client.accountType
      }
    }));
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
            value: openPipelineValue
          },
          quotaAttainment,
          salesForecast,
          salesVariance,
          monthlyExcessDeficit,
          quarterlyExcessDeficit,
          pipelineByStage,
          openDeals
        }
      }
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger34.error("BD dashboard failed", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/update.step.ts
import { logger as logger35 } from "motia";
import { z as z14 } from "zod";
import { Prisma as Prisma11 } from "@prisma/client";
var config35 = {
  name: "UpdateContact",
  description: "Update an existing contact",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/contacts/:id",
    bodySchema: z14.object({
      firstName: z14.string().min(1).optional(),
      lastName: z14.string().min(1).optional(),
      email: z14.string().email().optional(),
      phone: z14.string().optional(),
      jobTitle: z14.string().optional(),
      decisionMakerTier: z14.number().min(1).max(5).optional(),
      isPrimary: z14.boolean().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler35 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const { phone, jobTitle, decisionMakerTier, ...rest } = req.request.body;
    const rankMapping = {
      1: "TIER_1_ECONOMIC_BUYER",
      2: "TIER_2_DECISION_MAKER",
      3: "TIER_3_INFLUENCER",
      4: "TIER_4_END_USER",
      5: "TIER_5_GATEKEEPER"
    };
    const contact = await prisma.$transaction(async (tx) => {
      const updatedContact = await tx.contact.update({
        where: { id },
        data: {
          ...rest,
          ...phone && { number: phone },
          ...jobTitle && { designation: jobTitle },
          ...decisionMakerTier && { decisionRank: rankMapping[decisionMakerTier] }
        },
        include: { client: { select: { id: true, name: true } } }
      });
      if (req.request.body.isPrimary) {
        await tx.client.update({
          where: { id: updatedContact.clientId },
          data: { contactId: updatedContact.id }
        });
      }
      return updatedContact;
    });
    logger35.info("Contact updated", { contactId: id, by: user.id });
    return { status: 200, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma11.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: 404, body: { error: "Contact not found" } };
    }
    logger35.error("Failed to update contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/list.step.ts
import { logger as logger36 } from "motia";
var config36 = {
  name: "ListContacts",
  description: "Get list of all contacts",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/contacts"
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler36 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger36.info("Listing contacts", { userId: user.id });
    const contacts = await prisma.contact.findMany({
      include: {
        client: {
          // which company they belong to
          select: { id: true, name: true, accountType: true }
        },
        _count: { select: { dealContacts: true } }
        // how many deals they're on
      },
      orderBy: { lastName: "asc" }
    });
    return { status: 200, body: contacts };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger36.error("Failed to list contacts", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/create.step.ts
import { logger as logger37 } from "motia";
import { z as z15 } from "zod";
import { Prisma as Prisma12 } from "@prisma/client";
var config37 = {
  name: "CreateContact",
  description: "Create a new contact",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/contacts",
    bodySchema: z15.object({
      firstName: z15.string().min(1),
      lastName: z15.string().min(1),
      email: z15.string().email(),
      // email is required in the DB
      phone: z15.string().optional(),
      // maps to 'number' in DB
      jobTitle: z15.string().optional(),
      // maps to 'designation' in DB
      decisionMakerTier: z15.number().min(1).max(5).default(3),
      clientId: z15.string().min(1),
      isPrimary: z15.boolean().default(false)
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler37 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const {
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      decisionMakerTier,
      clientId,
      isPrimary
    } = req.request.body;
    const rankMapping = {
      1: "TIER_1_ECONOMIC_BUYER",
      2: "TIER_2_DECISION_MAKER",
      3: "TIER_3_INFLUENCER",
      4: "TIER_4_END_USER",
      5: "TIER_5_GATEKEEPER"
    };
    const contact = await prisma.$transaction(async (tx) => {
      const newContact = await tx.contact.create({
        data: {
          firstName,
          lastName,
          email,
          number: phone,
          // map phone -> number
          designation: jobTitle,
          // map jobTitle -> designation
          decisionRank: rankMapping[decisionMakerTier] || "TIER_3_INFLUENCER",
          clientId,
          isPrimary
        },
        include: { client: { select: { id: true, name: true } } }
      });
      if (isPrimary) {
        await tx.client.update({
          where: { id: clientId },
          data: { contactId: newContact.id }
        });
      }
      return newContact;
    });
    logger37.info("Contact created", { contactId: contact.id, by: user.id });
    return { status: 201, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma12.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Client not found \u2014 check clientId" } };
    }
    if (error instanceof Prisma12.PrismaClientValidationError || error instanceof Prisma12.PrismaClientKnownRequestError && error.code === "P2000") {
      return { status: 400, body: { error: "Invalid input \u2014 check field lengths and types" } };
    }
    logger37.error("Failed to create contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/update.step.ts
import { logger as logger38 } from "motia";
import { z as z16 } from "zod";
import { Prisma as Prisma13 } from "@prisma/client";
var config38 = {
  name: "UpdateClient",
  description: "Update an existing client",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/clients/:id",
    bodySchema: z16.object({
      name: z16.string().min(1).optional(),
      // all optional for partial update
      brand: z16.string().optional(),
      accountType: z16.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]).optional(),
      status: z16.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
      industryId: z16.string().optional(),
      contactId: z16.string().optional()
      // set primary contact
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler38 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return { status: 404, body: { error: "Client not found" } };
    }
    const { industryId, contactId, ...body } = req.request.body;
    const updated = await prisma.client.update({
      where: { id },
      data: {
        // Scalar fields
        ...body.name && { name: body.name },
        ...body.brand !== void 0 && { brand: body.brand },
        ...body.accountType && { accountType: body.accountType },
        ...body.status && { status: body.status },
        // Relation fields
        ...industryId && { industry: { connect: { id: industryId } } },
        ...contactId && { contact: { connect: { id: contactId } } }
      },
      include: { industry: true, contacts: true, contact: true }
    });
    logger38.info("Client updated", { clientId: id, by: user.id });
    return { status: 200, body: updated };
  } catch (error) {
    logger38.error("Failed to update client", { error: error.message, clientId: req.request.pathParams?.id });
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma13.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return {
        status: 400,
        body: { error: "Record not found or related ID is invalid" }
      };
    }
    return {
      status: 500,
      body: { error: error.message || "Internal Server Error" }
    };
  }
};

// steps/api/clients/list.step.ts
import { logger as logger39 } from "motia";
var config39 = {
  name: "ListClients",
  description: "Get list of all clients",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/clients"
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler39 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger39.info("Listing clients", { userId: user.id });
    const clients = await prisma.client.findMany({
      include: {
        industry: true,
        // join the industry name
        contacts: true,
        // all contacts for this client
        contact: true,
        // the primary contact
        _count: { select: { deals: true } }
        // how many deals
      },
      orderBy: {
        name: "asc"
      }
    });
    return { status: 200, body: clients };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger39.error("Failed to list clients", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/detail.step.ts
import { logger as logger40 } from "motia";
var config40 = {
  name: "GetClientDetail",
  description: "Get a single client by ID",
  triggers: [
    { type: "http", method: "GET", path: "/api/clients/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler40 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        industry: true,
        contact: true,
        // primary contact
        contacts: true,
        // all contacts
        deals: {
          // all deals for this client
          include: {
            stage: true,
            bd: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        referredBy: true
        // who referred this client
      }
    });
    if (!client) {
      return { status: 404, body: { error: "Client not found" } };
    }
    return { status: 200, body: client };
  } catch (error) {
    logger40.error("Failed to get client details", { error: error.message, clientId: req.request.pathParams.id });
    return {
      status: error.name === "AuthError" ? 401 : 500,
      body: { error: error.message || "Internal Server Error" }
    };
  }
};

// steps/api/clients/create.step.ts
import { logger as logger41 } from "motia";
import { z as z17 } from "zod";
import { Prisma as Prisma14 } from "@prisma/client";
var config41 = {
  name: "CreateClient",
  description: "Create a new client",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/clients",
    bodySchema: z17.object({
      // Zod validates BEFORE handler runs
      name: z17.string().min(1),
      // required
      brand: z17.string().optional(),
      accountType: z17.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]),
      status: z17.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
      industryId: z17.string().optional(),
      referralId: z17.string().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler41 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { name, brand, accountType, status, industryId, referralId } = req.request.body;
    const client = await prisma.client.create({
      data: { name, brand, accountType, status, industryId, referralId },
      include: { industry: true, contacts: true }
    });
    logger41.info("Client created", { clientId: client.id, by: user.id });
    return { status: 201, body: client };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma14.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Related record not found (check industryId, referralId)" } };
    }
    logger41.error("Failed to create client", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/update.step.ts
import { logger as logger42 } from "motia";
import { z as z18 } from "zod";
var config42 = {
  name: "UpdateBundle",
  description: "Updates a bundle name",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/bundles/:id",
      bodySchema: z18.object({
        name: z18.string().min(1).optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler42 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage bundles" } };
    }
    const { id } = req.request.pathParams;
    const { name } = req.request.body;
    const bundle = await prisma.bundle.update({
      where: { id },
      data: { ...name !== void 0 && { name: name.trim() } },
      include: {
        bundleServices: { include: { service: true } }
      }
    });
    return { status: 200, body: bundle };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2025") return { status: 404, body: { error: "Bundle not found" } };
    logger42.error("Failed to update bundle", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/removeService.step.ts
import { logger as logger43 } from "motia";
var config43 = {
  name: "RemoveServiceFromBundle",
  description: "Removes a service from a bundle",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/bundles/:bundleId/services/:serviceId" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler43 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage bundles" } };
    }
    const { bundleId, serviceId } = req.request.pathParams;
    await prisma.bundleService.delete({
      where: { serviceId_bundleId: { serviceId, bundleId } }
    });
    return { status: 200, body: { success: true } };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2025") return { status: 404, body: { error: "Service not found in this bundle" } };
    logger43.error("Failed to remove service from bundle", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/list.step.ts
import { logger as logger44 } from "motia";
var config44 = {
  name: "ListBundles",
  description: "Returns all bundles with their included services",
  triggers: [
    { type: "http", method: "GET", path: "/api/bundles" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler44 = async (req, ctx) => {
  try {
    await authenticate(req.request);
    const bundles = await prisma.bundle.findMany({
      include: {
        bundleServices: {
          include: { service: true },
          orderBy: { service: { name: "asc" } }
        }
      },
      orderBy: { name: "asc" }
    });
    return { status: 200, body: bundles };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    logger44.error("Failed to list bundles", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/delete.step.ts
import { logger as logger45 } from "motia";
var config45 = {
  name: "DeleteBundle",
  description: "Deletes a bundle (only if it has no active deals)",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/bundles/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler45 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage bundles" } };
    }
    const { id } = req.request.pathParams;
    const dealCount = await prisma.deal.count({ where: { bundleId: id } });
    if (dealCount > 0) {
      return {
        status: 409,
        body: { error: `Cannot delete bundle \u2014 it is used by ${dealCount} deal(s)` }
      };
    }
    await prisma.bundleService.deleteMany({ where: { bundleId: id } });
    await prisma.bundle.delete({ where: { id } });
    return { status: 200, body: { success: true, id } };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2025") return { status: 404, body: { error: "Bundle not found" } };
    logger45.error("Failed to delete bundle", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/create.step.ts
import { logger as logger46 } from "motia";
import { z as z19 } from "zod";
var config46 = {
  name: "CreateBundle",
  description: "Creates a new bundle",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/bundles",
      bodySchema: z19.object({
        name: z19.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler46 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage bundles" } };
    }
    const { name } = req.request.body;
    const bundle = await prisma.bundle.create({
      data: { name: name.trim() },
      include: {
        bundleServices: { include: { service: true } }
      }
    });
    return { status: 201, body: bundle };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    logger46.error("Failed to create bundle", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/bundles/addService.step.ts
import { logger as logger47 } from "motia";
import { z as z20 } from "zod";
var config47 = {
  name: "AddServiceToBundle",
  description: "Adds a service to a bundle with value and revenue-share configuration",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/bundles/:bundleId/services",
      bodySchema: z20.object({
        serviceId: z20.string().uuid(),
        name: z20.string().min(1),
        serviceValue: z20.number().min(0),
        revenueSharePct: z20.number().min(0).max(100)
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler47 = async (req, _ctx) => {
  try {
    const user = await authenticate(req.request);
    if (user.role !== "SALES_MANAGER") {
      return { status: 403, body: { error: "Only managers can manage bundles" } };
    }
    const { bundleId } = req.request.pathParams;
    const { serviceId, name, serviceValue, revenueSharePct } = req.request.body;
    const bundleService = await prisma.bundleService.create({
      data: {
        bundleId,
        serviceId,
        name: name.trim(),
        serviceValue,
        revenueSharePct
      },
      include: { service: true }
    });
    return { status: 201, body: bundleService };
  } catch (error) {
    if (error.name === "AuthError") return { status: 401, body: { error: error.message } };
    if (error.code === "P2002") return { status: 409, body: { error: "This service is already in the bundle" } };
    if (error.code === "P2003") return { status: 404, body: { error: "Bundle or service not found" } };
    logger47.error("Failed to add service to bundle", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/auth/me.step.ts
import { logger as logger48 } from "motia";
var config48 = {
  name: "AuthMe",
  description: "Get current authenticated user profile",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/auth/me"
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler48 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger48.info("Auth check successful", { userId: user.id });
    return {
      status: 200,
      body: { user }
    };
  } catch (error) {
    logger48.warn("Auth check failed", { error: error.message });
    return {
      status: 401,
      body: { error: "Not authenticated" }
    };
  }
};

// steps/api/auth/login.step.ts
import { logger as logger49 } from "motia";
import { z as z21 } from "zod";
import bcrypt from "bcrypt";
var config49 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z21.object({
        email: z21.string().email(),
        password: z21.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler49 = async (req, ctx) => {
  const { email, password } = req.request.body;
  logger49.info("Login attempt", { email });
  const bd = await prisma.bD.findUnique({
    where: { email }
  });
  if (!bd) {
    logger49.warn("Login failed - user not found", { email });
    return {
      status: 401,
      body: { error: "Invalid email or password" }
    };
  }
  if (!bd.isActive) {
    logger49.warn("Login failed - account deactivated", { email });
    return {
      status: 401,
      body: { error: "Account is deactivated" }
    };
  }
  const passwordValid = await bcrypt.compare(password, bd.password);
  if (!passwordValid) {
    logger49.warn("Login failed - wrong password", { email });
    return {
      status: 401,
      body: { error: "Invalid email or password" }
    };
  }
  const token = signToken({
    bdId: bd.id,
    email: bd.email,
    role: bd.role
  });
  logger49.info("Login successful", { email, role: bd.role });
  return {
    status: 200,
    body: {
      token,
      user: {
        id: bd.id,
        firstName: bd.firstName,
        lastName: bd.lastName,
        email: bd.email,
        role: bd.role
      }
    }
  };
};

// index-dev.js
initIII();
var motia = new Motia();
motia.addStep(config, "./steps/events/onDealStageChanged.step.ts", handler, "./steps/events/onDealStageChanged.step.ts");
motia.addStep(config2, "./steps/events/onDealCreated.step.ts", handler2, "./steps/events/onDealCreated.step.ts");
motia.addStep(config3, "./steps/cron/checkStuckDeals.step.ts", handler3, "./steps/cron/checkStuckDeals.step.ts");
motia.addStep(config4, "./steps/cron/checkBillingDue.step.ts", handler4, "./steps/cron/checkBillingDue.step.ts");
motia.addStep(config5, "./steps/cron/checkActionPlanDue.step.ts", handler5, "./steps/cron/checkActionPlanDue.step.ts");
motia.addStep(config6, "./steps/api/targets/upsertQuarterly.step.ts", handler6, "./steps/api/targets/upsertQuarterly.step.ts");
motia.addStep(config7, "./steps/api/targets/listQuarterly.step.ts", handler7, "./steps/api/targets/listQuarterly.step.ts");
motia.addStep(config8, "./steps/api/services/update.step.ts", handler8, "./steps/api/services/update.step.ts");
motia.addStep(config9, "./steps/api/services/list.step.ts", handler9, "./steps/api/services/list.step.ts");
motia.addStep(config10, "./steps/api/services/delete.step.ts", handler10, "./steps/api/services/delete.step.ts");
motia.addStep(config11, "./steps/api/services/create.step.ts", handler11, "./steps/api/services/create.step.ts");
motia.addStep(config12, "./steps/api/reporting/periods.step.ts", handler12, "./steps/api/reporting/periods.step.ts");
motia.addStep(config13, "./steps/api/reporting/growthComparison.step.ts", handler13, "./steps/api/reporting/growthComparison.step.ts");
motia.addStep(config14, "./steps/api/pipelineStages/list.step.ts", handler14, "./steps/api/pipelineStages/list.step.ts");
motia.addStep(config15, "./steps/api/payments/update.step.ts", handler15, "./steps/api/payments/update.step.ts");
motia.addStep(config16, "./steps/api/payments/overview.step.ts", handler16, "./steps/api/payments/overview.step.ts");
motia.addStep(config17, "./steps/api/payments/list.step.ts", handler17, "./steps/api/payments/list.step.ts");
motia.addStep(config18, "./steps/api/payments/delete.step.ts", handler18, "./steps/api/payments/delete.step.ts");
motia.addStep(config19, "./steps/api/payments/create.step.ts", handler19, "./steps/api/payments/create.step.ts");
motia.addStep(config20, "./steps/api/notifications/markRead.step.ts", handler20, "./steps/api/notifications/markRead.step.ts");
motia.addStep(config21, "./steps/api/notifications/markAllRead.step.ts", handler21, "./steps/api/notifications/markAllRead.step.ts");
motia.addStep(config22, "./steps/api/notifications/list.step.ts", handler22, "./steps/api/notifications/list.step.ts");
motia.addStep(config23, "./steps/api/growthEntries/update.step.ts", handler23, "./steps/api/growthEntries/update.step.ts");
motia.addStep(config24, "./steps/api/growthEntries/list.step.ts", handler24, "./steps/api/growthEntries/list.step.ts");
motia.addStep(config25, "./steps/api/growthEntries/create.step.ts", handler25, "./steps/api/growthEntries/create.step.ts");
motia.addStep(config26, "./steps/api/deals/updateStage.step.ts", handler26, "./steps/api/deals/updateStage.step.ts");
motia.addStep(config27, "./steps/api/deals/update.step.ts", handler27, "./steps/api/deals/update.step.ts");
motia.addStep(config28, "./steps/api/deals/terminate.step.ts", handler28, "./steps/api/deals/terminate.step.ts");
motia.addStep(config29, "./steps/api/deals/list.step.ts", handler29, "./steps/api/deals/list.step.ts");
motia.addStep(config30, "./steps/api/deals/history.step.ts", handler30, "./steps/api/deals/history.step.ts");
motia.addStep(config31, "./steps/api/deals/get.step.ts", handler31, "./steps/api/deals/get.step.ts");
motia.addStep(config32, "./steps/api/deals/create.step.ts", handler32, "./steps/api/deals/create.step.ts");
motia.addStep(config33, "./steps/api/dashboard/executive.step.ts", handler33, "./steps/api/dashboard/executive.step.ts");
motia.addStep(config34, "./steps/api/dashboard/bd.step.ts", handler34, "./steps/api/dashboard/bd.step.ts");
motia.addStep(config35, "./steps/api/contacts/update.step.ts", handler35, "./steps/api/contacts/update.step.ts");
motia.addStep(config36, "./steps/api/contacts/list.step.ts", handler36, "./steps/api/contacts/list.step.ts");
motia.addStep(config37, "./steps/api/contacts/create.step.ts", handler37, "./steps/api/contacts/create.step.ts");
motia.addStep(config38, "./steps/api/clients/update.step.ts", handler38, "./steps/api/clients/update.step.ts");
motia.addStep(config39, "./steps/api/clients/list.step.ts", handler39, "./steps/api/clients/list.step.ts");
motia.addStep(config40, "./steps/api/clients/detail.step.ts", handler40, "./steps/api/clients/detail.step.ts");
motia.addStep(config41, "./steps/api/clients/create.step.ts", handler41, "./steps/api/clients/create.step.ts");
motia.addStep(config42, "./steps/api/bundles/update.step.ts", handler42, "./steps/api/bundles/update.step.ts");
motia.addStep(config43, "./steps/api/bundles/removeService.step.ts", handler43, "./steps/api/bundles/removeService.step.ts");
motia.addStep(config44, "./steps/api/bundles/list.step.ts", handler44, "./steps/api/bundles/list.step.ts");
motia.addStep(config45, "./steps/api/bundles/delete.step.ts", handler45, "./steps/api/bundles/delete.step.ts");
motia.addStep(config46, "./steps/api/bundles/create.step.ts", handler46, "./steps/api/bundles/create.step.ts");
motia.addStep(config47, "./steps/api/bundles/addService.step.ts", handler47, "./steps/api/bundles/addService.step.ts");
motia.addStep(config48, "./steps/api/auth/me.step.ts", handler48, "./steps/api/auth/me.step.ts");
motia.addStep(config49, "./steps/api/auth/login.step.ts", handler49, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

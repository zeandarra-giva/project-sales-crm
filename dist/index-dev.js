// index-dev.js
import { Motia, initIII } from "motia";

// motia.config.ts
var authenticateStream = async (req, context) => {
  context.logger.info("Authenticating stream", { req });
  return { context: { userId: "sergio" } };
};

// lib/notifications.ts
import { NotificationType } from "@prisma/client";

// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// lib/notifications.ts
var DEDUP_TYPES = [
  NotificationType.DEAL_STUCK,
  NotificationType.ACTION_PLAN_DUE,
  NotificationType.FOLLOW_UP_DUE,
  NotificationType.LOST_DEAL_FOLLOW_UP
];
async function createNotification(args) {
  if (DEDUP_TYPES.includes(args.type) && args.dealId) {
    const startOfDay = /* @__PURE__ */ new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await prisma.notification.findFirst({
      where: {
        bdId: args.bdId,
        type: args.type,
        dealId: args.dealId,
        isRead: false,
        createdAt: { gte: startOfDay }
      }
    });
    if (existing) return;
  }
  await prisma.notification.create({
    data: {
      bdId: args.bdId,
      type: args.type,
      triggeredBy: args.triggeredBy,
      content: args.content,
      dealId: args.dealId,
      scheduledAt: args.scheduledAt
    }
  });
}
async function createQuotaNotification(args) {
  const startOfDay = /* @__PURE__ */ new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await prisma.notification.findFirst({
    where: {
      bdId: args.bdId,
      type: NotificationType.QUOTA_BEHIND_PACE,
      isRead: false,
      createdAt: { gte: startOfDay }
    }
  });
  if (existing) return;
  await prisma.notification.create({
    data: {
      bdId: args.bdId,
      type: args.type,
      triggeredBy: args.triggeredBy,
      content: args.content
    }
  });
}

// steps/events/onLeadAssigned.step.ts
import { NotificationTrigger as NotificationTrigger2 } from "@prisma/client";
var config = {
  name: "OnLeadAssigned",
  description: "Event: notifies BD when a lead is assigned",
  triggers: [{ type: "queue", topic: "lead.assigned" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler = async (event, { logger }) => {
  const { bd_id, deal_id, deal_name, client_name, lead_source } = event;
  const emoji = { INBOUND: "\u{1F4E5}", OUTBOUND: "\u{1F4E4}", REFERRAL: "\u{1F91D}" };
  await createNotification({
    bdId: bd_id,
    type: "NEW_DEAL_ASSIGNED",
    triggeredBy: NotificationTrigger2.STAGE_CHANGE,
    dealId: deal_id,
    content: `${emoji[lead_source] ?? "\u{1F4CB}"} New ${lead_source.toLowerCase()} lead: "${deal_name}" from ${client_name}.`
  });
  logger.info("OnLeadAssigned notification sent", { bd_id, deal_id });
};

// steps/events/onDealUpdated.step.ts
import { NotificationTrigger as NotificationTrigger3 } from "@prisma/client";
var config2 = {
  name: "OnDealUpdated",
  description: "Event: notifies BD when manager adds remarks to their deal",
  triggers: [{ type: "queue", topic: "deal.updated" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler2 = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, fields_changed, manager_notified } = event;
  if (manager_notified && fields_changed.includes("remarks")) {
    await createNotification({
      bdId: bd_id,
      type: "STAGE_CHANGE",
      triggeredBy: NotificationTrigger3.STAGE_CHANGE,
      dealId: deal_id,
      content: `\u{1F4DD} Manager added remarks to your deal "${deal_name}". Check for updated guidance.`
    });
  }
  logger.info("OnDealUpdated processed", { deal_id, fields_changed });
};

// steps/events/onDealStageChanged.step.ts
import { NotificationTrigger as NotificationTrigger4 } from "@prisma/client";
var config3 = {
  name: "OnDealStageChanged",
  description: "Event: fires STAGE_CHANGE notification and auto-generates payments on Proposal Sent",
  triggers: [{ type: "queue", topic: "deal.stage.changed" }],
  enqueues: [],
  flows: ["notifications"]
};
var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
async function generatePayments(deal_id, logger) {
  const deal = await prisma.deal.findUnique({
    where: { id: deal_id },
    select: { startDate: true, dueDate: true, duration: true, monthlySubscription: true }
  });
  if (!deal?.startDate || !deal?.monthlySubscription) {
    logger.warn("Skipping payment generation \u2014 deal missing startDate or monthlySubscription", { deal_id });
    return;
  }
  const months = deal.duration > 0 ? deal.duration : 1;
  await prisma.payment.deleteMany({ where: { dealId: deal_id } });
  for (let i = 0; i < months; i++) {
    const d = new Date(deal.startDate);
    d.setMonth(d.getMonth() + i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const dateId = `${year}-${String(month).padStart(2, "0")}`;
    await prisma.dateDimension.upsert({
      where: { id: dateId },
      update: {},
      create: {
        id: dateId,
        timestamp: new Date(year, month - 1, 1),
        year,
        month,
        monthNumber: month,
        day: 1,
        dayOfWeek: DAY_NAMES[new Date(year, month - 1, 1).getDay()],
        quarter,
        isQuarterEnd: month % 3 === 0
      }
    });
    await prisma.payment.create({
      data: {
        dealId: deal_id,
        amount: deal.monthlySubscription,
        // expected amount — BD can edit actual received
        dateId
      }
    });
  }
  logger.info("Auto-generated monthly payments", { deal_id, months });
}
var handler3 = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, old_stage, new_stage } = event;
  const emoji = new_stage === "Closed Won" ? "\u{1F389}" : new_stage === "Closed Lost" ? "\u274C" : new_stage === "Negotiation" ? "\u{1F91D}" : new_stage === "Proposal Sent" ? "\u{1F4C4}" : "\u{1F504}";
  await createNotification({
    bdId: bd_id,
    type: "STAGE_CHANGE",
    triggeredBy: NotificationTrigger4.STAGE_CHANGE,
    dealId: deal_id,
    content: `${emoji} "${deal_name}" moved from ${old_stage} \u2192 ${new_stage}.`
  });
  if (new_stage === "Proposal Sent") {
    await generatePayments(deal_id, logger);
  }
  if (new_stage === "Closed Won" || new_stage === "Closed Lost") {
    const [managers, deal] = await Promise.all([
      prisma.bD.findMany({ where: { role: "SALES_MANAGER", isActive: true }, select: { id: true } }),
      prisma.deal.findUnique({
        where: { id: deal_id },
        include: {
          client: { select: { name: true } },
          bd: { select: { firstName: true, lastName: true } }
        }
      })
    ]);
    const bdName = deal?.bd ? `${deal.bd.firstName} ${deal.bd.lastName}` : "BD";
    const revenue = deal?.revenue ? ` \u2014 \u20B1${Number(deal.revenue).toLocaleString()}` : "";
    for (const mgr of managers) {
      if (mgr.id === bd_id) continue;
      await createNotification({
        bdId: mgr.id,
        type: "STAGE_CHANGE",
        triggeredBy: NotificationTrigger4.STAGE_CHANGE,
        dealId: deal_id,
        content: `${emoji} ${bdName}'s deal "${deal_name}" (${deal?.client?.name}) was marked ${new_stage}${revenue}.`
      });
    }
  }
  logger.info("OnDealStageChanged processed", { deal_id, old_stage, new_stage });
};

// steps/events/onDealCreated.step.ts
import { NotificationTrigger as NotificationTrigger5 } from "@prisma/client";
var config4 = {
  name: "OnDealCreated",
  description: "Event: notifies BD when a deal is created (self or assigned by manager)",
  triggers: [{ type: "queue", topic: "deal.created" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler4 = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name, created_by_id } = event;
  const deal = await prisma.deal.findUnique({
    where: { id: deal_id },
    include: {
      client: { select: { name: true } },
      service: { select: { name: true } }
    }
  });
  const service = deal?.service?.name ?? "Bundle deal";
  const revenue = deal?.revenue ? `\u20B1${Number(deal.revenue).toLocaleString()}` : "TBD";
  const clientName = deal?.client?.name ?? "";
  if (created_by_id === bd_id) {
    await createNotification({
      bdId: bd_id,
      type: "NEW_DEAL_ASSIGNED",
      triggeredBy: NotificationTrigger5.STAGE_CHANGE,
      dealId: deal_id,
      content: `\u{1F4CB} Deal created: "${deal_name}" (${clientName}) \u2014 ${service}, ${revenue}. Move it forward when ready!`
    });
  } else {
    const creator = await prisma.bD.findUnique({
      where: { id: created_by_id },
      select: { firstName: true, lastName: true }
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : "Manager";
    await createNotification({
      bdId: bd_id,
      type: "NEW_DEAL_ASSIGNED",
      triggeredBy: NotificationTrigger5.STAGE_CHANGE,
      dealId: deal_id,
      content: `\u{1F4CB} ${creatorName} assigned you a new deal: "${deal_name}" (${clientName}) \u2014 ${service}, ${revenue}.`
    });
  }
  logger.info("OnDealCreated notification sent", { deal_id, bd_id });
};

// steps/events/onDealClosedWon.step.ts
var config5 = {
  name: "OnDealClosedWon",
  description: "Event: payments are already generated at Proposal Sent \u2014 nothing to do here",
  triggers: [{ type: "queue", topic: "deal.closed.won" }],
  enqueues: [],
  flows: ["payments"]
};
var handler5 = async (_event, { logger }) => {
  logger.info("OnDealClosedWon: payments already exist from Proposal Sent, skipping regeneration");
};

// steps/events/onDealClosedLost.step.ts
import { NotificationTrigger as NotificationTrigger6 } from "@prisma/client";
var config6 = {
  name: "OnDealClosedLost",
  description: "Event: schedules a 30-day follow-up reminder when a deal is lost",
  triggers: [{ type: "queue", topic: "deal.closed.lost" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler6 = async (event, { logger }) => {
  const { deal_id, bd_id, deal_name } = event;
  const deal = await prisma.deal.findUnique({ where: { id: deal_id }, include: { client: { select: { name: true } } } });
  if (!deal) return;
  const followUpDate = /* @__PURE__ */ new Date();
  followUpDate.setDate(followUpDate.getDate() + 30);
  await prisma.notification.create({
    data: {
      bdId: bd_id,
      type: "LOST_DEAL_FOLLOW_UP",
      triggeredBy: NotificationTrigger6.CLOSED_LOST_AGE,
      dealId: deal_id,
      scheduledAt: followUpDate,
      content: `\u{1F504} 30-day check-in: Follow up with ${deal.client.name} about "${deal_name}". Consider re-engagement.`
    }
  });
  logger.info("OnDealClosedLost: follow-up scheduled", { deal_id, followUpDate });
};

// steps/cron/weeklyForecastSnapshot.step.ts
import { cron } from "motia";
var config7 = {
  name: "WeeklyForecastSnapshot",
  description: "Cron: weekly point-in-time snapshot per BD and team-level for trend analysis",
  triggers: [cron("0 0 6 * * 1 *")],
  enqueues: [],
  flows: ["reporting"]
};
var handler7 = async (_req, { logger }) => {
  const openDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    select: {
      id: true,
      bdId: true,
      revenue: true,
      stageId: true,
      remarks: true,
      actionPlan: true,
      projection: {
        select: { probabilityPct: true, projectedAmount: true, weightedValue: true }
      }
    }
  });
  const bdMembers = await prisma.bD.findMany({
    where: { role: "BD_REP", isActive: true },
    select: { id: true }
  });
  const forecastRows = bdMembers.map((bd) => {
    const myDeals = openDeals.filter((d) => d.bdId === bd.id);
    return {
      bdId: bd.id,
      totalPipelineValue: myDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0),
      totalWeightedValue: myDeals.reduce((s, d) => s + Number(d.projection?.weightedValue ?? 0), 0),
      dealCount: myDeals.length
    };
  });
  forecastRows.push({
    bdId: null,
    totalPipelineValue: openDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0),
    totalWeightedValue: openDeals.reduce((s, d) => s + Number(d.projection?.weightedValue ?? 0), 0),
    dealCount: openDeals.length
  });
  const dealSnapshotData = openDeals.map((deal) => ({
    dealId: deal.id,
    stageId: deal.stageId,
    probabilityPct: deal.projection?.probabilityPct ?? null,
    projectedAmount: deal.projection?.projectedAmount ?? null,
    weightedValue: deal.projection?.weightedValue ?? null,
    remarks: deal.remarks ?? null,
    actionPlan: deal.actionPlan ?? null
  }));
  await prisma.$transaction([
    ...forecastRows.map((row) => prisma.forecastSnapshot.create({ data: row })),
    ...dealSnapshotData.map((row) => prisma.dealSnapshot.create({ data: row }))
  ]);
  logger.info("WeeklyForecastSnapshot completed", {
    forecastSnapshots: forecastRows.length,
    dealSnapshots: dealSnapshotData.length
  });
};

// steps/cron/checkStuckDeals.step.ts
import { cron as cron2 } from "motia";

// lib/pipeline.ts
var STAGE = {
  INQUIRY: "Inquiry",
  PROSPECTING: "Prospecting",
  DISCOVERY: "Discovery",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost"
};
var CLOSED_STAGE_NAMES = [STAGE.CLOSED_WON, STAGE.CLOSED_LOST];
var STAGE_PROBABILITY = {
  [STAGE.INQUIRY]: 10,
  [STAGE.PROSPECTING]: 20,
  [STAGE.DISCOVERY]: 40,
  [STAGE.PROPOSAL_SENT]: 60,
  [STAGE.NEGOTIATION]: 75,
  [STAGE.CLOSED_WON]: 100,
  [STAGE.CLOSED_LOST]: 0
};
function isClosedStage(stageName) {
  return CLOSED_STAGE_NAMES.includes(stageName);
}
function getProbability(stageName) {
  return STAGE_PROBABILITY[stageName] ?? 10;
}
function getDaysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1e3 * 60 * 60 * 24));
}
function getCurrentQuarter(date = /* @__PURE__ */ new Date()) {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const year = date.getFullYear();
  return { quarter, year, ...getQuarterRange(year, quarter) };
}
function getQuarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}
function getCurrentMonth() {
  const now = /* @__PURE__ */ new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
async function getStageByName(name) {
  const stage = await prisma.pipelineStage.findUnique({ where: { name } });
  if (!stage) throw new Error(`Pipeline stage not found: "${name}". Run the seed first.`);
  return stage;
}

// steps/cron/checkStuckDeals.step.ts
import { NotificationTrigger as NotificationTrigger7 } from "@prisma/client";
var config8 = {
  name: "CheckStuckDeals",
  description: "Cron: fires DEAL_STUCK notification for open deals exceeding their stage duration",
  triggers: [cron2("0 0 8 * * * *")],
  enqueues: [],
  flows: ["notifications"]
};
var handler8 = async (_req, { logger }) => {
  const activeDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    include: {
      stage: true,
      client: { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1 }
    }
  });
  let fired = 0;
  for (const deal of activeDeals) {
    const log = deal.auditLogs[0];
    if (!log || deal.stage.duration === null) continue;
    const daysInStage = getDaysSince(log.enteredAt);
    if (daysInStage <= deal.stage.duration) continue;
    await createNotification({
      bdId: deal.bdId,
      type: "DEAL_STUCK",
      triggeredBy: NotificationTrigger7.DAYS_IN_STAGE_EXCEEDED,
      dealId: deal.id,
      content: `\u26A0\uFE0F "${deal.dealName}" (${deal.client.name}) has been in ${deal.stage.name} for ${daysInStage} days \u2014 target is ${deal.stage.duration}d.`
    });
    fired++;
  }
  logger.info("CheckStuckDeals completed", { checked: activeDeals.length, fired });
};

// steps/cron/checkQuotaPacing.step.ts
import { cron as cron3 } from "motia";
import { NotificationTrigger as NotificationTrigger8 } from "@prisma/client";
var config9 = {
  name: "CheckQuotaPacing",
  description: "Cron: fires QUOTA_BEHIND_PACE for BD members behind expected quarterly pace",
  triggers: [cron3("0 0 9 * * 1 *")],
  enqueues: [],
  flows: ["notifications"]
};
var handler9 = async (_req, { logger }) => {
  const { quarter, year, start, end } = getCurrentQuarter();
  const now = /* @__PURE__ */ new Date();
  const totalDays = (end.getTime() - start.getTime()) / 864e5;
  const elapsed = (now.getTime() - start.getTime()) / 864e5;
  const expectedPct = Math.min(Math.round(elapsed / totalDays * 100), 100);
  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } });
  const bdMembers = await prisma.bD.findMany({
    where: { role: "BD_REP", isActive: true },
    select: { id: true, firstName: true, lastName: true }
  });
  const managers = await prisma.bD.findMany({
    where: { role: "SALES_MANAGER", isActive: true },
    select: { id: true }
  });
  const quarterDates = await prisma.dateDimension.findMany({
    where: { year, quarter },
    select: { id: true }
  });
  const dateIds = quarterDates.map((d) => d.id);
  let fired = 0;
  for (const bd of bdMembers) {
    const quota = await prisma.target.findFirst({
      where: { bdId: bd.id, periodType: "QUARTERLY", dateId: { in: dateIds } }
    });
    if (!quota || Number(quota.quota) === 0) continue;
    const actual = wonStage ? await prisma.deal.aggregate({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _sum: { revenue: true }
    }) : { _sum: { revenue: null } };
    const forecast = await prisma.dealProjection.aggregate({
      where: { bdId: bd.id, deal: { isClosed: false } },
      _sum: { weightedValue: true }
    });
    const actualRev = Number(actual._sum.revenue ?? 0);
    const attainmentPct = Math.round(actualRev / Number(quota.quota) * 100);
    if (attainmentPct >= expectedPct - 15) continue;
    const gap = Number(quota.quota) - actualRev;
    const forecastedPct = Math.round(
      (actualRev + Number(forecast._sum.weightedValue ?? 0)) / Number(quota.quota) * 100
    );
    const content = `\u{1F4CA} ${bd.firstName} ${bd.lastName} is at ${attainmentPct}% quota attainment (expected ${expectedPct}% at this point in Q${quarter}). Gap: \u20B1${gap.toLocaleString()}. Forecasted: ${forecastedPct}%.`;
    await createQuotaNotification({ bdId: bd.id, type: "QUOTA_BEHIND_PACE", triggeredBy: NotificationTrigger8.QUOTA_BEHIND_PACE, content });
    for (const mgr of managers) {
      await createQuotaNotification({ bdId: mgr.id, type: "QUOTA_BEHIND_PACE", triggeredBy: NotificationTrigger8.QUOTA_BEHIND_PACE, content });
    }
    fired++;
  }
  logger.info("CheckQuotaPacing completed", { quarter, year, expectedPct, fired });
};

// steps/cron/checkLostDealFollowUp.step.ts
import { cron as cron4 } from "motia";
import { NotificationTrigger as NotificationTrigger9 } from "@prisma/client";
var config10 = {
  name: "CheckLostDealFollowUp",
  description: "Cron: re-engagement reminder 30 days after Closed Lost",
  triggers: [cron4("0 0 9 * * 1 *")],
  enqueues: [],
  flows: ["notifications"]
};
var handler10 = async (_req, { logger }) => {
  const target = /* @__PURE__ */ new Date();
  target.setDate(target.getDate() - 30);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  const lostStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } });
  if (!lostStage) return;
  const lostDeals = await prisma.deal.findMany({
    where: { stageId: lostStage.id, closedDate: { gte: start, lte: end } },
    include: { client: { select: { name: true } } }
  });
  let fired = 0;
  for (const deal of lostDeals) {
    await createNotification({
      bdId: deal.bdId,
      type: "LOST_DEAL_FOLLOW_UP",
      triggeredBy: NotificationTrigger9.CLOSED_LOST_AGE,
      dealId: deal.id,
      content: `\u{1F504} It's been 30 days since "${deal.dealName}" (${deal.client.name}) was Closed Lost. Consider re-engagement.`
    });
    fired++;
  }
  logger.info("CheckLostDealFollowUp completed", { fired });
};

// steps/cron/checkFollowUpDue.step.ts
import { cron as cron5 } from "motia";
import { NotificationTrigger as NotificationTrigger10 } from "@prisma/client";
var THRESHOLD_DAYS = 14;
var config11 = {
  name: "CheckFollowUpDue",
  description: "Cron: fires FOLLOW_UP_DUE for open deals with no follow-up in 14+ days",
  triggers: [cron5("0 0 8 * * 1-5")],
  enqueues: [],
  flows: ["notifications"]
};
var handler11 = async (_req, { logger }) => {
  const cutoff = /* @__PURE__ */ new Date();
  cutoff.setDate(cutoff.getDate() - THRESHOLD_DAYS);
  const staleDeals = await prisma.deal.findMany({
    where: {
      isClosed: false,
      OR: [
        { lastFollowUpAt: { lte: cutoff } },
        { lastFollowUpAt: null, startDate: { lte: cutoff } }
      ]
    },
    include: { client: { select: { name: true } }, stage: { select: { name: true } } }
  });
  let fired = 0;
  for (const deal of staleDeals) {
    const lastActivity = deal.lastFollowUpAt ?? deal.startDate ?? /* @__PURE__ */ new Date();
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 864e5);
    await createNotification({
      bdId: deal.bdId,
      type: "FOLLOW_UP_DUE",
      triggeredBy: NotificationTrigger10.NO_FOLLOW_UP_IN_14_DAYS,
      dealId: deal.id,
      content: `\u{1F4DE} No follow-up on "${deal.dealName}" (${deal.client.name}) in ${daysSince} days. Stage: ${deal.stage.name}.`
    });
    fired++;
  }
  logger.info("CheckFollowUpDue completed", { fired });
};

// steps/cron/checkActionPlanDue.step.ts
import { cron as cron6 } from "motia";
import { NotificationTrigger as NotificationTrigger11 } from "@prisma/client";
var config12 = {
  name: "CheckActionPlanDue",
  description: "Cron: fires ACTION_PLAN_DUE for deals whose action plan due date is today or overdue",
  triggers: [cron6("0 0 7 * * *")],
  enqueues: [],
  flows: ["notifications"]
};
var handler12 = async (_req, { logger }) => {
  const now = /* @__PURE__ */ new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const overdueDeals = await prisma.deal.findMany({
    where: {
      isClosed: false,
      actionPlanDueDate: { lte: endOfToday },
      actionPlan: { not: null }
    },
    include: { client: { select: { name: true } } }
  });
  let fired = 0;
  for (const deal of overdueDeals) {
    const dueDate = deal.actionPlanDueDate;
    const isOverdue = dueDate < now;
    const daysOverdue = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / 864e5) : 0;
    const content = isOverdue ? `\u{1F534} Action plan for "${deal.dealName}" (${deal.client.name}) is ${daysOverdue}d overdue.` : `\u{1F4CB} Action plan for "${deal.dealName}" (${deal.client.name}) is due today.`;
    await createNotification({
      bdId: deal.bdId,
      type: "ACTION_PLAN_DUE",
      triggeredBy: NotificationTrigger11.ACTION_PLAN_PASSED,
      dealId: deal.id,
      content
    });
    fired++;
  }
  logger.info("CheckActionPlanDue completed", { fired });
};

// lib/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "sales-crm-secret-change-in-production";
var JWT_EXPIRES = "7d";
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
async function authenticate(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return { error: "Missing authorization header", status: 401, user: null };
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { error: "Invalid authorization format. Use: Bearer <token>", status: 401, user: null };
  }
  try {
    const payload = verifyToken(token);
    const user = await prisma.bD.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true }
    });
    if (!user || !user.isActive) {
      return { error: "User not found or deactivated", status: 401, user: null };
    }
    return { error: null, status: 200, user };
  } catch {
    return { error: "Invalid or expired token", status: 401, user: null };
  }
}
function requireManager(role) {
  return role === "SALES_MANAGER";
}

// steps/api/services/List.step.ts
var config13 = {
  name: "ServicesList",
  description: "List all active services",
  triggers: [{ type: "http", path: "/api/services", method: "GET" }],
  enqueues: [],
  flows: ["services"]
};
var handler13 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  logger.info("Services listed", { count: services.length });
  return { status: 200, body: { services } };
};

// steps/api/reports/winloss.step.ts
var config14 = {
  name: "GetWinLossReport",
  description: "Win/loss analysis with final proposed values, remarks, and loss notes",
  triggers: [{ type: "http", path: "/api/reports/win-loss", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler14 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const dealWhere = { isClosed: true };
  if (!requireManager(user.role)) dealWhere.bdId = user.id;
  if (q.bd_id && requireManager(user.role)) dealWhere.bdId = q.bd_id;
  if (q.service_id) dealWhere.serviceId = q.service_id;
  const [wonStage, lostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } })
  ]);
  const closed = await prisma.deal.findMany({
    where: dealWhere,
    include: {
      stage: true,
      bd: { select: { firstName: true, lastName: true } },
      client: { select: { name: true, accountType: true } },
      service: { select: { name: true } },
      auditLogs: wonStage && lostStage ? { where: { stageId: lostStage.id }, take: 1 } : void 0
    },
    orderBy: { closedDate: "desc" }
  });
  const won = wonStage ? closed.filter((d) => d.stageId === wonStage.id) : [];
  const lost = lostStage ? closed.filter((d) => d.stageId === lostStage.id) : [];
  const totalWonRevenue = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const totalLostValue = lost.reduce((s, d) => s + Number(d.finalProposedValue ?? 0), 0);
  const winRate = closed.length > 0 ? Math.round(won.length / closed.length * 100) : 0;
  const avgSalesCycle = closed.length > 0 ? Math.round(closed.reduce((s, d) => s + (d.salesCycleDays ?? 0), 0) / closed.length) : 0;
  logger.info("Win/loss report generated");
  return {
    status: 200,
    body: {
      summary: {
        totalClosed: closed.length,
        won: won.length,
        lost: lost.length,
        winRate,
        totalWonRevenue,
        totalLostValue,
        avgSalesCycleDays: avgSalesCycle
      },
      wonDeals: won,
      lostDeals: lost.map((d) => ({ ...d, closingNotes: d.auditLogs?.[0]?.notes }))
    }
  };
};

// steps/api/reports/services.step.ts
var config15 = {
  name: "GetServiceReport",
  description: "Service performance \u2014 revenue, deal count, win rate, avg sales cycle per service",
  triggers: [{ type: "http", path: "/api/reports/services", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler15 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const [wonStage, lostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } })
  ]);
  const services = await prisma.service.findMany({ where: { isActive: true } });
  const rows = await Promise.all(services.map(async (svc) => {
    const deals = await prisma.deal.findMany({
      where: { serviceId: svc.id },
      select: { stageId: true, revenue: true, isClosed: true, salesCycleDays: true }
    });
    const won = wonStage ? deals.filter((d) => d.stageId === wonStage.id) : [];
    const lost = lostStage ? deals.filter((d) => d.stageId === lostStage.id) : [];
    const closed = [...won, ...lost];
    const revenue = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
    const winRate = closed.length > 0 ? Math.round(won.length / closed.length * 100) : 0;
    const avgCycle = closed.length > 0 ? Math.round(closed.reduce((s, d) => s + (d.salesCycleDays ?? 0), 0) / closed.length) : 0;
    return {
      service: svc,
      totalDeals: deals.length,
      won: won.length,
      lost: lost.length,
      active: deals.filter((d) => !d.isClosed).length,
      revenue,
      winRate,
      avgDealSize: won.length > 0 ? Math.round(revenue / won.length) : 0,
      avgSalesCycleDays: avgCycle
    };
  }));
  const stageAvgs = await prisma.dealAuditLog.groupBy({
    by: ["stageId"],
    where: { daysInStage: { not: null } },
    _avg: { daysInStage: true }
  });
  const allStages = await prisma.pipelineStage.findMany();
  const stageAvgsNamed = stageAvgs.map((row) => ({
    stageName: allStages.find((s) => s.id === row.stageId)?.name ?? row.stageId,
    avgDays: row._avg.daysInStage ? +Number(row._avg.daysInStage).toFixed(1) : null
  }));
  logger.info("Service report generated");
  return { status: 200, body: { services: rows, avgDaysPerStage: stageAvgsNamed } };
};

// steps/api/reports/salesCycle.step.ts
var config16 = {
  name: "GetSalesCycleReport",
  description: "Sales cycle analysis \u2014 avg days per stage, bottlenecks, comparison by BD member",
  triggers: [{ type: "http", path: "/api/reports/sales-cycle", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler16 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  let bdIdFilter;
  if (!requireManager(user.role)) bdIdFilter = user.id;
  else if (q.bd_id) bdIdFilter = q.bd_id;
  let auditDealIds;
  if (bdIdFilter) {
    const deals = await prisma.deal.findMany({ where: { bdId: bdIdFilter }, select: { id: true } });
    auditDealIds = deals.map((d) => d.id);
  }
  const [wonStage, closedLostStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_LOST } })
  ]);
  const closedStageIds = [wonStage?.id, closedLostStage?.id].filter(Boolean);
  const stageAvgs = await prisma.dealAuditLog.groupBy({
    by: ["stageId"],
    where: {
      daysInStage: { not: null },
      stageId: { notIn: closedStageIds },
      ...auditDealIds ? { dealId: { in: auditDealIds } } : {}
    },
    _avg: { daysInStage: true },
    _count: { id: true }
  });
  const allStages = await prisma.pipelineStage.findMany();
  const dealWhere = {
    ...bdIdFilter ? { bdId: bdIdFilter } : {},
    isClosed: true,
    salesCycleDays: { not: null }
  };
  const cycleByOutcome = await prisma.deal.groupBy({
    by: ["stageId"],
    where: dealWhere,
    _avg: { salesCycleDays: true },
    _min: { salesCycleDays: true },
    _max: { salesCycleDays: true },
    _count: { id: true }
  });
  const fastestDeals = wonStage ? await prisma.deal.findMany({
    where: { ...bdIdFilter ? { bdId: bdIdFilter } : {}, stageId: wonStage.id, salesCycleDays: { not: null } },
    orderBy: { salesCycleDays: "asc" },
    take: 3,
    include: {
      client: { select: { name: true } },
      service: { select: { name: true } },
      bd: { select: { firstName: true, lastName: true } }
    }
  }) : [];
  const bdCycles = requireManager(user.role) && wonStage ? await prisma.deal.groupBy({
    by: ["bdId"],
    where: { stageId: wonStage.id, salesCycleDays: { not: null } },
    _avg: { salesCycleDays: true },
    _count: { id: true }
  }) : [];
  const proposalRevisions = await prisma.deal.aggregate({
    where: { ...bdIdFilter ? { bdId: bdIdFilter } : {}, isClosed: true },
    _avg: { proposalRevisionCount: true },
    _max: { proposalRevisionCount: true }
  });
  logger.info("GetSalesCycleReport computed");
  return {
    status: 200,
    body: {
      avgDaysPerStage: stageAvgs.map((s) => ({
        stageName: allStages.find((st) => st.id === s.stageId)?.name ?? s.stageId,
        avgDays: s._avg.daysInStage ? +Number(s._avg.daysInStage).toFixed(1) : null,
        sampleCount: s._count.id
      })),
      cycleByOutcome: cycleByOutcome.map((c) => ({
        ...c,
        stageName: allStages.find((s) => s.id === c.stageId)?.name ?? c.stageId
      })),
      fastestDeals,
      bdComparison: bdCycles,
      proposalStats: {
        avgRevisions: proposalRevisions._avg.proposalRevisionCount ? +Number(proposalRevisions._avg.proposalRevisionCount).toFixed(1) : null,
        maxRevisions: proposalRevisions._max.proposalRevisionCount
      }
    }
  };
};

// steps/api/reports/quota.step.ts
var config17 = {
  name: "GetQuotaReport",
  description: "Quota vs actual per BD member for a given quarter",
  triggers: [{ type: "http", path: "/api/reports/quota", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler17 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const now = /* @__PURE__ */ new Date();
  const year = parseInt(q.year ?? String(now.getFullYear()));
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1));
  const { start, end } = getQuarterRange(year, quarter);
  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } });
  const bdFilter = !requireManager(user.role) ? { id: user.id } : {};
  const bds = await prisma.bD.findMany({
    where: { ...bdFilter, role: "BD_REP", isActive: true },
    select: { id: true, firstName: true, lastName: true }
  });
  const quarterDates = await prisma.dateDimension.findMany({
    where: { year, quarter },
    select: { id: true }
  });
  const dateIds = quarterDates.map((d) => d.id);
  const rows = await Promise.all(bds.map(async (bd) => {
    const quota = await prisma.target.findFirst({
      where: { bdId: bd.id, periodType: "QUARTERLY", dateId: { in: dateIds } }
    });
    const actual = wonStage ? await prisma.deal.aggregate({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _sum: { revenue: true }
    }) : { _sum: { revenue: null } };
    const won = wonStage ? await prisma.deal.count({
      where: { bdId: bd.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } }
    }) : 0;
    const quotaVal = Number(quota?.quota ?? 0);
    const actualVal = Number(actual._sum.revenue ?? 0);
    return {
      bd: { id: bd.id, firstName: bd.firstName, lastName: bd.lastName },
      quota: quotaVal,
      actual: actualVal,
      variance: quotaVal - actualVal,
      attainmentPct: quotaVal > 0 ? Math.round(actualVal / quotaVal * 100) : 0,
      dealsWon: won
    };
  }));
  logger.info("Quota report generated", { year, quarter });
  return { status: 200, body: { year, quarter, rows } };
};

// steps/api/reports/pipeline.step.ts
var config18 = {
  name: "GetPipelineReport",
  description: "Pipeline report \u2014 deal count and total value per stage",
  triggers: [{ type: "http", path: "/api/reports/pipeline", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler18 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const dealWhere = {};
  if (!requireManager(user.role)) dealWhere.bdId = user.id;
  else if (q.bd_id) dealWhere.bdId = q.bd_id;
  if (q.service_id) dealWhere.serviceId = q.service_id;
  const allStages = await prisma.pipelineStage.findMany();
  const byStage = await prisma.deal.groupBy({
    by: ["stageId"],
    where: { ...dealWhere, isClosed: false },
    _count: { id: true },
    _sum: { revenue: true }
  });
  const openIds = await prisma.deal.findMany({
    where: { ...dealWhere, isClosed: false },
    select: { id: true }
  });
  const weightedAgg = await prisma.dealProjection.aggregate({
    where: { dealId: { in: openIds.map((d) => d.id) } },
    _sum: { weightedValue: true }
  });
  const lostStage = allStages.find((s) => s.name === "Closed Lost");
  const lostDeals = lostStage ? await prisma.deal.findMany({
    where: { ...dealWhere, stageId: lostStage.id },
    select: { finalProposedValue: true }
  }) : [];
  logger.info("Pipeline report generated");
  return {
    status: 200,
    body: {
      byStage: byStage.map((row) => ({
        ...row,
        stageName: allStages.find((s) => s.id === row.stageId)?.name ?? row.stageId
      })),
      totalWeightedValue: Number(weightedAgg._sum.weightedValue ?? 0),
      lostDealValue: lostDeals.reduce((s, d) => s + Number(d.finalProposedValue ?? 0), 0)
    }
  };
};

// steps/api/reports/growth.step.ts
var config19 = {
  name: "GetGrowthReport",
  description: "Revenue trend by month or quarter with MoM/QoQ deltas",
  triggers: [{ type: "http", path: "/api/reports/growth", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler19 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const unit = q.unit ?? "quarter";
  const periods = parseInt(q.periods ?? "6");
  const now = /* @__PURE__ */ new Date();
  const bdWhere = !requireManager(user.role) ? { bdId: user.id } : {};
  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } });
  const trend = [];
  for (let i = periods - 1; i >= 0; i--) {
    let start, end, label;
    if (unit === "month") {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      label = d.toLocaleDateString("en-PH", { year: "numeric", month: "short" });
    } else {
      const curQ = Math.floor(now.getMonth() / 3) + 1;
      let tQ = curQ - i;
      let tY = now.getFullYear();
      while (tQ <= 0) {
        tQ += 4;
        tY--;
      }
      const r = getQuarterRange(tY, tQ);
      start = r.start;
      end = r.end;
      label = `Q${tQ} ${tY}`;
    }
    const [won, created] = await Promise.all([
      wonStage ? prisma.deal.aggregate({
        where: { ...bdWhere, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
        _sum: { revenue: true },
        _count: { id: true }
      }) : Promise.resolve({ _sum: { revenue: null }, _count: { id: 0 } }),
      prisma.deal.aggregate({
        where: { ...bdWhere, startDate: { gte: start, lte: end } },
        _sum: { revenue: true },
        _count: { id: true }
      })
    ]);
    trend.push({
      period: label,
      revenue: Number(won._sum.revenue ?? 0),
      deals: won._count.id,
      newPipeline: Number(created._sum.revenue ?? 0)
    });
  }
  const withDelta = trend.map((t, i) => {
    if (i === 0) return { ...t, deltaPct: null };
    const prev = trend[i - 1].revenue;
    const deltaPct = prev > 0 ? +((t.revenue - prev) / prev * 100).toFixed(1) : null;
    return { ...t, deltaPct };
  });
  logger.info("GetGrowthReport computed", { unit, periods });
  return { status: 200, body: { unit, periods, trend: withDelta } };
};

// steps/api/reports/breakdown.step.ts
var config20 = {
  name: "GetBreakdownReport",
  description: "Full quarterly breakdown \u2014 BD, client type, service, lead source, industry, pricing, vendor",
  triggers: [{ type: "http", path: "/api/reports/breakdown", method: "GET" }],
  enqueues: [],
  flows: ["reports"]
};
var handler20 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  if (!requireManager(user.role)) {
    return { status: 403, body: { error: "Breakdown report is restricted to Sales Managers" } };
  }
  const q = req.queryParams;
  const now = /* @__PURE__ */ new Date();
  const year = parseInt(q.year ?? String(now.getFullYear()));
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1));
  const { start, end } = getQuarterRange(year, quarter);
  const wonStage = await prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } });
  if (!wonStage) return { status: 500, body: { error: "Pipeline stages not seeded yet" } };
  const wonDeals = await prisma.deal.findMany({
    where: { stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    include: {
      bd: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { name: true, accountType: true, referralId: true, industry: { select: { name: true } } } },
      service: { select: { id: true, name: true } },
      bundle: { select: { id: true, name: true } }
    }
  });
  const totalRevenue = wonDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const totalDeals = wonDeals.length;
  const bdMap = {};
  for (const d of wonDeals) {
    if (!bdMap[d.bdId]) bdMap[d.bdId] = { bdName: `${d.bd.firstName} ${d.bd.lastName}`, revenue: 0, count: 0 };
    bdMap[d.bdId].revenue += Number(d.revenue ?? 0);
    bdMap[d.bdId].count++;
  }
  const byBd = Object.values(bdMap).map((b) => ({ ...b, pct: totalRevenue > 0 ? +(b.revenue / totalRevenue * 100).toFixed(1) : 0 })).sort((a, b) => b.revenue - a.revenue);
  const byAccountType = ["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"].map((type) => {
    const deals = wonDeals.filter((d) => d.client.accountType === type);
    const revenue = deals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
    return { accountType: type, count: deals.length, revenue, pct: totalRevenue > 0 ? +(revenue / totalRevenue * 100).toFixed(1) : 0 };
  }).filter((r) => r.count > 0);
  const svcMap = {};
  for (const d of wonDeals) {
    const key = d.serviceId ?? d.bundleId ?? "bundle";
    const label = d.service?.name ?? d.bundle?.name ?? "Bundle";
    if (!svcMap[key]) svcMap[key] = { name: label, revenue: 0, count: 0 };
    svcMap[key].revenue += Number(d.revenue ?? 0);
    svcMap[key].count++;
  }
  const byService = Object.values(svcMap).map((s) => ({ ...s, pct: totalRevenue > 0 ? +(s.revenue / totalRevenue * 100).toFixed(1) : 0 })).sort((a, b) => b.revenue - a.revenue);
  const byLeadSource = ["INBOUND", "OUTBOUND", "REFERRAL"].map((src) => {
    const deals = wonDeals.filter((d) => d.leadSource === src);
    const revenue = deals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
    return { leadSource: src, count: deals.length, revenue, pct: totalRevenue > 0 ? +(revenue / totalRevenue * 100).toFixed(1) : 0 };
  }).filter((r) => r.count > 0);
  const indMap = {};
  for (const d of wonDeals) {
    const name = d.client.industry?.name ?? "Unknown";
    if (!indMap[name]) indMap[name] = { industry: name, revenue: 0, count: 0 };
    indMap[name].revenue += Number(d.revenue ?? 0);
    indMap[name].count++;
  }
  const industryBreakdown = Object.values(indMap).sort((a, b) => b.revenue - a.revenue);
  const allServices = await prisma.service.findMany({ where: { isActive: true } });
  const avgPricing = await Promise.all(allServices.map(async (svc) => {
    const agg = await prisma.deal.aggregate({
      where: { serviceId: svc.id, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
      _avg: { monthlySubscription: true },
      _count: { id: true }
    });
    return {
      service: svc.name,
      avgMonthly: agg._avg.monthlySubscription ? +Number(agg._avg.monthlySubscription).toFixed(2) : null,
      dealCount: agg._count.id
    };
  }));
  const overallAvg = await prisma.deal.aggregate({
    where: { stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    _avg: { monthlySubscription: true }
  });
  const bundleAvg = await prisma.deal.aggregate({
    where: { bundleId: { not: null }, stageId: wonStage.id, closedDate: { gte: start, lte: end } },
    _avg: { monthlySubscription: true },
    _count: { id: true }
  });
  const withReferral = wonDeals.filter((d) => d.client.referralId);
  const withoutReferral = wonDeals.filter((d) => !d.client.referralId);
  const refClientIds = [...new Set(withReferral.map((d) => d.client.referralId).filter(Boolean))];
  const refClients = refClientIds.length > 0 ? await prisma.client.findMany({ where: { id: { in: refClientIds } }, select: { id: true, name: true } }) : [];
  const refMap = {};
  for (const d of withReferral) {
    const refId = d.client.referralId;
    const refName = refClients.find((c) => c.id === refId)?.name ?? refId;
    if (!refMap[refId]) refMap[refId] = { vendor: refName, count: 0 };
    refMap[refId].count++;
  }
  const vendorBreakdown = [
    ...Object.values(refMap).sort((a, b) => b.count - a.count),
    { vendor: "None", count: withoutReferral.length }
  ].filter((v) => v.count > 0);
  const prevQ = quarter === 1 ? 4 : quarter - 1;
  const prevY = quarter === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = getQuarterRange(prevY, prevQ);
  const prevRevAgg = await prisma.deal.aggregate({
    where: { stageId: wonStage.id, closedDate: { gte: prevStart, lte: prevEnd } },
    _sum: { revenue: true }
  });
  const prevTotal = Number(prevRevAgg._sum.revenue ?? 0);
  const quarterlyTrend = await Promise.all(
    Array.from({ length: 4 }, (_, i) => {
      let tQ = quarter - i;
      let tY = year;
      while (tQ <= 0) {
        tQ += 4;
        tY--;
      }
      const { start: tS, end: tE } = getQuarterRange(tY, tQ);
      return prisma.deal.aggregate({
        where: { stageId: wonStage.id, closedDate: { gte: tS, lte: tE } },
        _sum: { revenue: true },
        _count: { id: true }
      }).then((r) => ({ period: `Q${tQ} ${tY}`, revenue: Number(r._sum.revenue ?? 0), deals: r._count.id }));
    })
  ).then((r) => r.reverse());
  logger.info("GetBreakdownReport computed", { year, quarter, totalDeals, totalRevenue });
  return {
    status: 200,
    body: {
      period: { year, quarter, label: `${year} Q${quarter} BREAKDOWN`, start, end },
      summary: { totalRevenue, totalDeals },
      byBd,
      byAccountType,
      byService,
      byLeadSource,
      industryBreakdown,
      avgPricing: {
        overall: overallAvg._avg.monthlySubscription ? +Number(overallAvg._avg.monthlySubscription).toFixed(2) : null,
        bundle: bundleAvg._avg.monthlySubscription ? +Number(bundleAvg._avg.monthlySubscription).toFixed(2) : null,
        bundleDealCount: bundleAvg._count.id,
        byService: avgPricing
      },
      vendorBreakdown,
      growth: {
        prevQuarterRevenue: prevTotal,
        currentRevenue: totalRevenue,
        qoqGrowthPct: prevTotal > 0 ? +((totalRevenue - prevTotal) / prevTotal * 100).toFixed(1) : null,
        quarterlyTrend
      }
    }
  };
};

// steps/api/pipelineStages/list.step.ts
var config21 = {
  name: "ListPipelineStages",
  description: "Returns all pipeline stages with duration thresholds and win probabilities",
  triggers: [{ type: "http", path: "/api/pipeline-stages", method: "GET" }],
  enqueues: [],
  flows: ["deals"]
};
var handler21 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const stages = await prisma.pipelineStage.findMany({
    orderBy: { name: "asc" }
  });
  const withProbability = stages.map((s) => ({
    ...s,
    probability: STAGE_PROBABILITY[s.name] ?? null
  }));
  logger.info("Pipeline stages listed");
  return { status: 200, body: { stages: withProbability } };
};

// steps/api/payments/update.step.ts
import { z } from "zod";
var bodySchema = z.object({
  amount: z.number().min(0)
  // 0 = nothing received this month
});
var config22 = {
  name: "UpdatePayment",
  description: "Update the received amount for a payment month. Month/date is fixed \u2014 only amount can change.",
  triggers: [{ type: "http", path: "/api/payments/:id", method: "PATCH", bodySchema }],
  enqueues: [],
  flows: ["payments"]
};
var handler22 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const { amount } = req.body;
  const existing = await prisma.payment.findUnique({
    where: { id },
    include: {
      deal: {
        select: {
          bdId: true,
          revenue: true,
          monthlySubscription: true,
          duration: true
        }
      }
    }
  });
  if (!existing) return { status: 404, body: { error: "Payment not found" } };
  if (!requireManager(user.role) && existing.deal.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  const payment = await prisma.payment.update({
    where: { id },
    data: { amount },
    include: {
      date: true,
      deal: { select: { id: true, dealName: true, client: { select: { name: true } } } }
    }
  });
  logger.info("Payment amount updated", { paymentId: id, amount });
  return { status: 200, body: { payment } };
};

// steps/api/payments/list.step.ts
var config23 = {
  name: "GetPayments",
  description: "List payment records",
  triggers: [{ type: "http", path: "/api/payments", method: "GET" }],
  enqueues: [],
  flows: ["payments"]
};
var handler23 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const dealFilter = {};
  if (!requireManager(user.role)) dealFilter.bdId = user.id;
  if (q.deal_id) dealFilter.id = q.deal_id;
  const payments = await prisma.payment.findMany({
    where: { deal: dealFilter },
    include: {
      date: true,
      deal: {
        select: {
          id: true,
          dealName: true,
          revenue: true,
          bd: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { name: true } },
          stage: { select: { name: true } },
          monthlySubscription: true,
          duration: true
        }
      }
    },
    orderBy: { id: "asc" }
  });
  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0);
  logger.info("Payments fetched", { count: payments.length });
  return { status: 200, body: { payments, totalReceived } };
};

// steps/api/payments/delete.step.ts
var config24 = {
  name: "DeletePayment",
  description: "Delete a payment record",
  triggers: [{ type: "http", path: "/api/payments/:id", method: "DELETE" }],
  enqueues: [],
  flows: ["payments"]
};
var handler24 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const existing = await prisma.payment.findUnique({
    where: { id },
    include: { deal: true }
  });
  if (!existing) return { status: 404, body: { error: "Payment not found" } };
  if (!requireManager(user.role) && existing.deal.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  await prisma.payment.delete({ where: { id } });
  logger.info("Payment deleted", { paymentId: id });
  return { status: 200, body: { message: "Payment deleted" } };
};

// steps/api/payments/create.step.ts
import { z as z2 } from "zod";
var bodySchema2 = z2.object({
  dealId: z2.string().uuid(),
  amount: z2.number().positive(),
  year: z2.coerce.number().int(),
  month: z2.coerce.number().int().min(1).max(12)
});
var config25 = {
  name: "CreatePayment",
  description: "Log a monthly payment against a deal \u2014 auto-creates a DateDimension record",
  triggers: [{ type: "http", path: "/api/payments", method: "POST", bodySchema: bodySchema2 }],
  enqueues: [],
  flows: ["payments"]
};
var DAY_NAMES2 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var handler25 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { dealId, amount, year, month } = req.body;
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { status: 404, body: { error: "Deal not found" } };
  if (!requireManager(user.role) && deal.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  const ts = new Date(year, month - 1, 1);
  const quarter = Math.ceil(month / 3);
  const dateDim = await prisma.dateDimension.upsert({
    where: { id: `${year}-${String(month).padStart(2, "0")}` },
    update: {},
    create: {
      id: `${year}-${String(month).padStart(2, "0")}`,
      timestamp: ts,
      year,
      month,
      monthNumber: month,
      day: 1,
      dayOfWeek: DAY_NAMES2[ts.getDay()],
      quarter,
      isQuarterEnd: month % 3 === 0
    }
  });
  const payment = await prisma.payment.create({
    data: { dealId, amount, dateId: dateDim.id },
    include: {
      date: true,
      deal: { select: { id: true, dealName: true, client: { select: { name: true } } } }
    }
  });
  logger.info("Payment created", { paymentId: payment.id, dealId, year, month });
  return { status: 201, body: { payment } };
};

// steps/api/notifications/markRead.step.ts
var config26 = {
  name: "MarkNotificationRead",
  description: "Mark a single notification as read",
  triggers: [{ type: "http", path: "/api/notifications/:id/read", method: "PATCH" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler26 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return { status: 404, body: { error: "Notification not found" } };
  if (notification.bdId !== user.id) return { status: 403, body: { error: "Forbidden" } };
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  logger.info("Notification marked read", { id });
  return { status: 200, body: { ok: true } };
};

// steps/api/notifications/markAllRead.step.ts
var config27 = {
  name: "MarkAllNotificationsRead",
  description: "Mark all notifications as read for the current user",
  triggers: [{ type: "http", path: "/api/notifications/read-all", method: "PATCH" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler27 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { count } = await prisma.notification.updateMany({
    where: { bdId: user.id, isRead: false },
    data: { isRead: true }
  });
  logger.info("All notifications marked read", { count });
  return { status: 200, body: { updated: count } };
};

// steps/api/notifications/list.step.ts
var config28 = {
  name: "GetNotifications",
  description: "Get notifications for the authenticated BD member",
  triggers: [{ type: "http", path: "/api/notifications", method: "GET" }],
  enqueues: [],
  flows: ["notifications"]
};
var handler28 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const notifications = await prisma.notification.findMany({
    where: {
      bdId: user.id,
      isRead: q.unread_only === "true" ? false : void 0,
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: /* @__PURE__ */ new Date() } }
      ]
    },
    include: {
      deal: {
        select: {
          id: true,
          dealName: true,
          stage: { select: { name: true } },
          client: { select: { name: true, accountType: true } },
          bd: { select: { firstName: true, lastName: true, role: true } },
          auditLogs: {
            orderBy: { enteredAt: "asc" },
            select: {
              id: true,
              enteredAt: true,
              exitedAt: true,
              daysInStage: true,
              remarks: true,
              actionPlan: true,
              actionPlanDueDate: true,
              stage: { select: { name: true } },
              changedBy: { select: { firstName: true, lastName: true } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const notificationsWithSnapshot = notifications.map((n) => {
    if (!n.deal) return n;
    const createdAt = n.createdAt;
    const logsAtTime = n.deal.auditLogs.filter(
      (log) => new Date(log.enteredAt) <= createdAt
    );
    return {
      ...n,
      deal: { ...n.deal, auditLogs: logsAtTime }
    };
  });
  const unreadCount = await prisma.notification.count({
    where: {
      bdId: user.id,
      isRead: false,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: /* @__PURE__ */ new Date() } }]
    }
  });
  logger.info("Notifications fetched", { count: notifications.length });
  return { status: 200, body: { notifications: notificationsWithSnapshot, unreadCount } };
};

// steps/api/industries/Industries.step.ts
var config29 = {
  name: "IndustriesList",
  description: "List all industries",
  triggers: [{ type: "http", path: "/api/industries", method: "GET" }],
  enqueues: [],
  flows: ["services"]
};
var handler29 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const industries = await prisma.industry.findMany({ orderBy: { name: "asc" } });
  return { status: 200, body: { industries } };
};

// steps/api/deals/update.step.ts
import { z as z3 } from "zod";
var bodySchema3 = z3.object({
  dealName: z3.string().max(255).optional(),
  remarks: z3.string().optional(),
  actionPlan: z3.string().optional(),
  actionPlanDueDate: z3.string().nullable().optional(),
  startDate: z3.string().nullable().optional(),
  // dueDate is NOT accepted from client — always auto-computed from startDate + duration
  proposalLink: z3.url().nullable().optional(),
  contractLink: z3.url().nullable().optional(),
  finalProposedValue: z3.number().nullable().optional(),
  monthlySubscription: z3.number().positive().optional(),
  duration: z3.number().int().positive().optional(),
  lastFollowUpAt: z3.string().optional(),
  leadSource: z3.enum(["INBOUND", "OUTBOUND", "REFERRAL"]).optional()
});
var config30 = {
  name: "UpdateDeal",
  description: "Update deal fields \u2014 excludes stage changes (use the stage endpoint)",
  triggers: [
    { type: "http", path: "/api/deals/:id", method: "PATCH", bodySchema: bodySchema3 }
  ],
  enqueues: ["deal.updated"],
  flows: ["deals"]
};
var handler30 = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const body = req.body;
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Deal not found" } };
  if (!requireManager(user.role) && existing.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  const data = {};
  if (body.dealName !== void 0) data.dealName = body.dealName;
  if (body.remarks !== void 0) data.remarks = body.remarks;
  if (body.actionPlan !== void 0) data.actionPlan = body.actionPlan;
  if (body.proposalLink !== void 0) data.proposalLink = body.proposalLink;
  if (body.contractLink !== void 0) data.contractLink = body.contractLink;
  if (body.finalProposedValue !== void 0) data.finalProposedValue = body.finalProposedValue;
  if (body.lastFollowUpAt !== void 0) data.lastFollowUpAt = new Date(body.lastFollowUpAt);
  if (body.leadSource !== void 0) data.leadSource = body.leadSource;
  if (body.actionPlanDueDate !== void 0) {
    data.actionPlanDueDate = body.actionPlanDueDate ? new Date(body.actionPlanDueDate) : null;
  }
  const newStartDate = body.startDate !== void 0 ? body.startDate ? new Date(body.startDate) : null : existing.startDate;
  const newDuration = body.duration ?? existing.duration;
  if (body.startDate !== void 0) data.startDate = newStartDate;
  if (body.startDate !== void 0 || body.duration !== void 0) {
    if (newStartDate && newDuration) {
      const d = new Date(newStartDate);
      d.setMonth(d.getMonth() + newDuration);
      d.setDate(d.getDate() - 1);
      data.dueDate = d;
    } else {
      data.dueDate = null;
    }
  }
  if (body.monthlySubscription !== void 0 || body.duration !== void 0) {
    const sub = body.monthlySubscription ?? Number(existing.monthlySubscription);
    const dur = newDuration;
    const revenue = sub * dur;
    data.monthlySubscription = sub;
    data.duration = dur;
    data.revenue = revenue;
    await prisma.dealProjection.update({
      where: { dealId: id },
      data: { projectedAmount: revenue, weightedValue: revenue * (Number(existing.monthlySubscription) / 100) }
    });
  }
  const deal = await prisma.deal.update({ where: { id }, data });
  await enqueue({
    topic: "deal.updated",
    data: {
      deal_id: id,
      bd_id: existing.bdId,
      deal_name: existing.dealName,
      fields_changed: Object.keys(data),
      manager_notified: requireManager(user.role) && existing.bdId !== user.id
    }
  });
  logger.info("Deal updated", { dealId: id });
  return { status: 200, body: { deal } };
};

// steps/api/deals/stage.step.ts
import { z as z4 } from "zod";
var bodySchema4 = z4.object({
  stageName: z4.string().min(1),
  remarks: z4.string().min(1, "Remarks are required"),
  actionPlan: z4.string().min(1, "Action plan is required"),
  actionPlanDueDate: z4.string().min(1, "Action plan due date is required"),
  notes: z4.string().optional(),
  finalProposedValue: z4.number().optional(),
  contractLink: z4.string().optional()
});
var config31 = {
  name: "ChangeDealStage",
  description: "Move a deal to a new pipeline stage \u2014 closes current audit log, opens new one, updates projection",
  triggers: [
    { type: "http", path: "/api/deals/:id/stage", method: "PATCH", bodySchema: bodySchema4 }
  ],
  enqueues: ["deal.stage.changed", "deal.closed.won", "deal.closed.lost"],
  flows: ["deals", "notifications"]
};
var handler31 = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const { stageName, notes, remarks, actionPlan, actionPlanDueDate, finalProposedValue, contractLink } = req.body;
  const [deal, newStage] = await Promise.all([
    prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
        auditLogs: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1 }
      }
    }),
    getStageByName(stageName)
  ]);
  if (!deal) return { status: 404, body: { error: "Deal not found" } };
  if (!requireManager(user.role) && deal.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  if (deal.stageId === newStage.id) {
    return { status: 400, body: { error: `Deal is already in stage: ${stageName}` } };
  }
  const isClosed = isClosedStage(stageName);
  const stagesRequiringDates = ["Proposal Sent", "Negotiation", "Closed Won"];
  if (stagesRequiringDates.includes(stageName)) {
    const missing = [];
    if (!deal.startDate) missing.push("Contract Start Date");
    if (!deal.dueDate) missing.push("Expected Close Date");
    if (missing.length > 0) {
      return {
        status: 422,
        body: { error: `Please fill in ${missing.join(" and ")} on the deal before moving to "${stageName}".` }
      };
    }
  }
  const now = /* @__PURE__ */ new Date();
  const probability = getProbability(stageName);
  const updatedDeal = await prisma.$transaction(async (tx) => {
    const currentLog = deal.auditLogs[0];
    if (currentLog) {
      const daysInStage = Math.floor((now.getTime() - currentLog.enteredAt.getTime()) / 864e5);
      await tx.dealAuditLog.update({
        where: { id: currentLog.id },
        data: { exitedAt: now, daysInStage }
      });
    }
    await tx.dealAuditLog.create({
      data: {
        dealId: id,
        stageId: newStage.id,
        changedById: user.id,
        enteredAt: now,
        notes: notes ?? null,
        remarks: remarks.trim(),
        actionPlan: actionPlan.trim(),
        actionPlanDueDate: new Date(actionPlanDueDate)
      }
    });
    const dealUpdate = {
      stageId: newStage.id,
      lastStageUpdateAt: now,
      isClosed
    };
    if (isClosed) {
      dealUpdate.closedDate = now;
      dealUpdate.salesCycleDays = Math.floor((now.getTime() - (deal.startDate ?? now).getTime()) / 864e5);
    }
    if (stageName === "Closed Lost" && finalProposedValue !== void 0) {
      dealUpdate.finalProposedValue = finalProposedValue;
    }
    if (stageName === "Closed Won" && contractLink) {
      dealUpdate.contractLink = contractLink;
    }
    const updated = await tx.deal.update({ where: { id }, data: dealUpdate });
    await tx.dealProjection.update({
      where: { dealId: id },
      data: {
        probabilityPct: probability,
        weightedValue: Number(updated.revenue ?? 0) * (probability / 100)
      }
    });
    return updated;
  });
  await enqueue({
    topic: "deal.stage.changed",
    data: {
      deal_id: id,
      bd_id: deal.bdId,
      deal_name: deal.dealName,
      old_stage: deal.stage.name,
      new_stage: stageName
    }
  });
  if (stageName === "Closed Won") {
    await enqueue({ topic: "deal.closed.won", data: { deal_id: id, bd_id: deal.bdId } });
  }
  if (stageName === "Closed Lost") {
    await enqueue({
      topic: "deal.closed.lost",
      data: {
        deal_id: id,
        bd_id: deal.bdId,
        deal_name: deal.dealName,
        closing_notes: notes
      }
    });
  }
  logger.info("Deal stage changed", { dealId: id, from: deal.stage.name, to: stageName });
  return { status: 200, body: { deal: updatedDeal } };
};

// steps/api/deals/list.step.ts
var config32 = {
  name: "GetDeals",
  description: "List deals \u2014 BD members see own deals, Manager sees all",
  triggers: [{ type: "http", path: "/api/deals", method: "GET" }],
  enqueues: [],
  flows: ["deals"]
};
var handler32 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const isClosed = q.is_closed !== void 0 ? q.is_closed === "true" : void 0;
  const where = {};
  if (!requireManager(user.role)) where.bdId = user.id;
  else if (q.bd_id) where.bdId = q.bd_id;
  if (q.stage_id) where.stageId = q.stage_id;
  if (isClosed !== void 0) where.isClosed = isClosed;
  if (q.lead_source) where.leadSource = q.lead_source;
  if (q.client_id) where.clientId = q.client_id;
  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: { select: { id: true, name: true, duration: true } },
      bd: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { id: true, name: true, brand: true, accountType: true } },
      service: { select: { id: true, name: true } },
      bundle: { select: { id: true, name: true } },
      projection: true,
      auditLogs: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1 }
    },
    orderBy: { id: "desc" }
  });
  const enriched = deals.map((deal) => {
    const log = deal.auditLogs[0];
    const days = log ? getDaysSince(log.enteredAt) : 0;
    const maxDays = deal.stage.duration;
    return { ...deal, daysInCurrentStage: days, isStuck: maxDays !== null && days > maxDays };
  });
  logger.info("Deals fetched", { count: enriched.length });
  return { status: 200, body: { deals: enriched } };
};

// steps/api/deals/history.step.ts
var config33 = {
  name: "GetDealHistory",
  description: "GET /api/deals/:id/history \u2014 returns stage audit log for a deal",
  triggers: [
    { type: "http", path: "/api/deals/:id/history", method: "GET" }
  ],
  enqueues: [],
  flows: ["deals"]
};
var handler33 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const deal = await prisma.deal.findUnique({ where: { id }, select: { id: true } });
  if (!deal) return { status: 404, body: { error: "Deal not found" } };
  const history = await prisma.dealAuditLog.findMany({
    where: { dealId: id },
    include: {
      stage: { select: { name: true } },
      changedBy: { select: { firstName: true, lastName: true } }
    },
    orderBy: { enteredAt: "asc" }
  });
  const mapped = history.map((h) => ({
    id: h.id,
    stage_name: h.stage.name,
    entered_at: h.enteredAt,
    exited_at: h.exitedAt,
    days_in_stage: h.daysInStage,
    notes: h.notes,
    remarks: h.remarks ?? null,
    action_plan: h.actionPlan ?? null,
    action_plan_due_date: h.actionPlanDueDate ?? null,
    changed_by: `${h.changedBy.firstName} ${h.changedBy.lastName}`
  }));
  logger.info("GetDealHistory", { dealId: id, count: mapped.length });
  return { status: 200, body: { history: mapped } };
};

// steps/api/deals/get.step.ts
var config34 = {
  name: "GetDeal",
  description: "Get a single deal by ID with full stage history",
  triggers: [{ type: "http", path: "/api/deals/:id", method: "GET" }],
  enqueues: [],
  flows: ["deals"]
};
var handler34 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      bd: { select: { id: true, firstName: true, lastName: true, email: true } },
      client: { select: { id: true, name: true, brand: true, accountType: true, industryId: true } },
      service: true,
      bundle: { include: { bundleServices: { include: { service: true } } } },
      projection: true,
      auditLogs: { include: { stage: true }, orderBy: { enteredAt: "asc" } },
      dealContacts: { include: { contact: true } },
      payments: { orderBy: { id: "asc" } }
    }
  });
  if (!deal) return { status: 404, body: { error: "Deal not found" } };
  if (!requireManager(user.role) && deal.bdId !== user.id) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  const currentLog = deal.auditLogs.find((l) => l.exitedAt === null);
  const daysInStage = currentLog ? getDaysSince(currentLog.enteredAt) : 0;
  const stuckDuration = deal.stage.duration;
  const isStuck = stuckDuration !== null && daysInStage > stuckDuration;
  logger.info("Deal fetched", { dealId: id });
  return { status: 200, body: { deal: { ...deal, daysInCurrentStage: daysInStage, isStuck } } };
};

// steps/api/deals/delete.step.ts
var config35 = {
  name: "DeleteDeal",
  description: "Hard delete a deal and its audit logs",
  triggers: [{ type: "http", path: "/api/deals/:id", method: "DELETE" }],
  enqueues: [],
  flows: ["deals"]
};
var handler35 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  await prisma.dealAuditLog.deleteMany({ where: { dealId: id } });
  await prisma.deal.delete({ where: { id } });
  logger.info("Deal deleted", { dealId: id });
  return { status: 200, body: { success: true } };
};

// steps/api/deals/create.step.ts
import { z as z5 } from "zod";
var bodySchema5 = z5.object({
  dealName: z5.string().min(1).max(255),
  monthlySubscription: z5.number().positive(),
  duration: z5.number().int().positive(),
  leadSource: z5.enum(["INBOUND", "OUTBOUND", "REFERRAL"]),
  clientId: z5.uuid(),
  serviceId: z5.uuid().optional(),
  bundleId: z5.uuid().optional(),
  remarks: z5.string().min(1, "Remarks are required"),
  actionPlan: z5.string().min(1, "Action plan is required"),
  actionPlanDueDate: z5.string().min(1, "Action plan due date is required"),
  startDate: z5.string().optional(),
  dueDate: z5.string().optional(),
  initialMeetingDate: z5.string().optional()
});
var config36 = {
  name: "CreateDeal",
  description: "Create a new deal \u2014 auto-sets stage to Inquiry, creates audit log and projection",
  triggers: [{ type: "http", path: "/api/deals", method: "POST", bodySchema: bodySchema5 }],
  enqueues: ["deal.created"],
  flows: ["deals"]
};
var handler36 = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const body = req.body;
  if (!body.serviceId && !body.bundleId || body.serviceId && body.bundleId) {
    return { status: 400, body: { error: "Provide exactly one of serviceId or bundleId" } };
  }
  const inquiryStage = await getStageByName(STAGE.INQUIRY);
  const revenue = body.monthlySubscription * body.duration;
  const probability = getProbability(STAGE.INQUIRY);
  const startDate = body.startDate ? new Date(body.startDate) : null;
  let dueDate = null;
  if (body.dueDate) {
    dueDate = new Date(body.dueDate);
  } else if (startDate && body.duration) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + body.duration);
    d.setDate(d.getDate() - 1);
    dueDate = d;
  }
  const deal = await prisma.$transaction(async (tx) => {
    const deal2 = await tx.deal.create({
      data: {
        dealName: body.dealName,
        monthlySubscription: body.monthlySubscription,
        duration: body.duration,
        revenue,
        stageId: inquiryStage.id,
        leadSource: body.leadSource,
        clientId: body.clientId,
        bdId: user.id,
        serviceId: body.serviceId,
        bundleId: body.bundleId,
        startDate,
        dueDate,
        initialMeetingDate: body.initialMeetingDate ? new Date(body.initialMeetingDate) : void 0
      }
    });
    await tx.dealAuditLog.create({
      data: {
        dealId: deal2.id,
        stageId: inquiryStage.id,
        changedById: user.id,
        enteredAt: /* @__PURE__ */ new Date(),
        notes: "Deal created",
        remarks: body.remarks.trim(),
        actionPlan: body.actionPlan.trim(),
        actionPlanDueDate: new Date(body.actionPlanDueDate)
      }
    });
    await tx.dealProjection.create({
      data: {
        dealId: deal2.id,
        bdId: user.id,
        projectedAmount: revenue,
        probabilityPct: probability,
        weightedValue: revenue * (probability / 100)
      }
    });
    return deal2;
  });
  await enqueue({
    topic: "deal.created",
    data: { deal_id: deal.id, bd_id: user.id, deal_name: deal.dealName, created_by_id: user.id }
  });
  logger.info("Deal created", { dealId: deal.id });
  return { status: 201, body: { deal } };
};

// steps/api/dashboard/executive.step.ts
var config37 = {
  name: "GetExecutiveDashboard",
  description: "Manager-only executive dashboard \u2014 team quota, leaderboard, pipeline, stuck deals",
  triggers: [{ type: "http", path: "/api/dashboard/executive", method: "GET" }],
  enqueues: [],
  flows: ["dashboard"]
};
var handler37 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  if (!requireManager(user.role)) {
    return { status: 403, body: { error: "Executive dashboard is restricted to Sales Managers" } };
  }
  const q = req.queryParams;
  const now = /* @__PURE__ */ new Date();
  const year = parseInt(q.year ?? String(now.getFullYear()));
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1));
  const { start: qStart, end: qEnd } = getQuarterRange(year, quarter);
  const [closedWonStage, negotiationStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.NEGOTIATION } })
  ]);
  const bdMembers = await prisma.bD.findMany({
    where: { role: "BD_REP", isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true, role: true }
  });
  const closedDeals = closedWonStage ? await prisma.deal.findMany({
    where: { stageId: closedWonStage.id, closedDate: { gte: qStart, lte: qEnd } },
    select: {
      bdId: true,
      revenue: true,
      leadSource: true,
      client: { select: { accountType: true, industry: { select: { name: true } } } },
      service: { select: { name: true } }
    }
  }) : [];
  const allTargets = await prisma.target.findMany({
    where: { periodType: "QUARTERLY", date: { year, quarter } },
    include: { date: true }
  });
  const allClosed = await prisma.deal.findMany({
    where: { isClosed: true },
    select: { bdId: true, stageId: true }
  });
  const leaderboard = bdMembers.map((bd) => {
    const won = closedDeals.filter((d) => d.bdId === bd.id);
    const revenue = won.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
    const quota = Number(allTargets.find((t) => t.bdId === bd.id)?.quota ?? 0);
    const myAll = allClosed.filter((d) => d.bdId === bd.id);
    const wonCount = closedWonStage ? myAll.filter((d) => d.stageId === closedWonStage.id).length : 0;
    const winRate = myAll.length > 0 ? Math.round(wonCount / myAll.length * 100) : 0;
    return {
      bd,
      revenue,
      quota,
      attainmentPct: quota > 0 ? Math.round(revenue / quota * 100) : 0,
      dealsWon: won.length,
      winRate
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const teamRevenue = leaderboard.reduce((s, l) => s + l.revenue, 0);
  const teamQuota = leaderboard.reduce((s, l) => s + l.quota, 0);
  const allStages = await prisma.pipelineStage.findMany();
  const pipelineByStage = await prisma.deal.groupBy({
    by: ["stageId"],
    where: { isClosed: false },
    _count: { id: true },
    _sum: { revenue: true }
  });
  const pipelineWithNames = pipelineByStage.map((row) => ({
    ...row,
    stageName: allStages.find((s) => s.id === row.stageId)?.name ?? row.stageId
  }));
  const negotiationVal = negotiationStage ? await prisma.deal.aggregate({
    where: { stageId: negotiationStage.id, isClosed: false },
    _sum: { revenue: true }
  }) : { _sum: { revenue: null } };
  const weightedForecast = await prisma.dealProjection.aggregate({
    where: { deal: { isClosed: false } },
    _sum: { weightedValue: true }
  });
  const activeDeals = await prisma.deal.findMany({
    where: { isClosed: false },
    include: {
      stage: true,
      bd: { select: { firstName: true, lastName: true } },
      client: { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, take: 1 }
    }
  });
  const stuckDeals = activeDeals.map((d) => {
    const log = d.auditLogs[0];
    const days = log ? getDaysSince(log.enteredAt) : 0;
    const max = d.stage.duration;
    return { ...d, daysInStage: days, isStuck: max !== null && days > max };
  }).filter((d) => d.isStuck);
  const byAccountType = ["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"].map((type) => ({
    accountType: type,
    count: closedDeals.filter((d) => d.client.accountType === type).length,
    revenue: closedDeals.filter((d) => d.client.accountType === type).reduce((s, d) => s + Number(d.revenue ?? 0), 0)
  }));
  const serviceMap = {};
  for (const d of closedDeals) {
    const svc = d.service?.name ?? "Bundle";
    if (!serviceMap[svc]) serviceMap[svc] = { count: 0, revenue: 0 };
    serviceMap[svc].count++;
    serviceMap[svc].revenue += Number(d.revenue ?? 0);
  }
  const byBD = bdMembers.map((bd) => {
    const won = closedDeals.filter((d) => d.bdId === bd.id);
    return {
      bd_id: bd.id,
      bd_name: `${bd.firstName} ${bd.lastName}`,
      count: won.length,
      revenue: won.reduce((s, d) => s + Number(d.revenue ?? 0), 0)
    };
  }).filter((b) => b.count > 0);
  const leadSourceMap = {};
  for (const d of closedDeals) {
    const src = d.leadSource ?? "UNKNOWN";
    if (!leadSourceMap[src]) leadSourceMap[src] = { count: 0, revenue: 0 };
    leadSourceMap[src].count++;
    leadSourceMap[src].revenue += Number(d.revenue ?? 0);
  }
  const industryMap = {};
  for (const d of closedDeals) {
    const ind = d.client?.industry?.name ?? "Unspecified";
    if (!industryMap[ind]) industryMap[ind] = { count: 0, revenue: 0 };
    industryMap[ind].count++;
    industryMap[ind].revenue += Number(d.revenue ?? 0);
  }
  logger.info("Executive dashboard computed", { year, quarter });
  return {
    status: 200,
    body: {
      period: { year, quarter, start: qStart, end: qEnd },
      team: {
        totalRevenue: teamRevenue,
        totalQuota: teamQuota,
        attainmentPct: teamQuota > 0 ? Math.round(teamRevenue / teamQuota * 100) : 0,
        salesForecast: teamRevenue + Number(negotiationVal._sum.revenue ?? 0),
        weightedForecast: Number(weightedForecast._sum.weightedValue ?? 0)
      },
      leaderboard,
      pipelineByStage: pipelineWithNames,
      stuckDeals,
      byAccountType,
      byService: Object.entries(serviceMap).map(([service, data]) => ({ service, ...data })),
      byBD,
      byLeadSource: Object.entries(leadSourceMap).map(([source, data]) => ({ source, ...data })),
      byIndustry: Object.entries(industryMap).map(([industry, data]) => ({ industry, ...data })).sort((a, b) => b.revenue - a.revenue)
    }
  };
};

// steps/api/dashboard/bd.step.ts
var config38 = {
  name: "GetBDDashboard",
  description: "Individual BD dashboard \u2014 quota attainment, pipeline metrics, stuck deals",
  triggers: [{ type: "http", path: "/api/dashboard/bd", method: "GET" }],
  enqueues: [],
  flows: ["dashboard"]
};
var handler38 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const now = /* @__PURE__ */ new Date();
  const year = parseInt(q.year ?? String(now.getFullYear()));
  const quarter = parseInt(q.quarter ?? String(Math.floor(now.getMonth() / 3) + 1));
  const bdId = requireManager(user.role) && q.bd_id ? q.bd_id : user.id;
  const { start: qStart, end: qEnd } = getQuarterRange(year, quarter);
  const { start: mStart, end: mEnd } = getCurrentMonth();
  const [closedWonStage, negotiationStage] = await Promise.all([
    prisma.pipelineStage.findUnique({ where: { name: STAGE.CLOSED_WON } }),
    prisma.pipelineStage.findUnique({ where: { name: STAGE.NEGOTIATION } })
  ]);
  const targets = await prisma.target.findMany({
    where: { bdId },
    include: { date: true }
  });
  const quarterTarget = targets.find(
    (t) => t.periodType === "QUARTERLY" && t.date && t.date.year === year && t.date.quarter === quarter
  );
  const monthTarget = targets.find(
    (t) => t.periodType === "MONTHLY" && t.date && t.date.year === year && t.date.monthNumber === now.getMonth() + 1
  );
  const closedDeals = closedWonStage ? await prisma.deal.findMany({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: qStart, lte: qEnd } },
    select: { revenue: true, dealName: true, client: { select: { name: true } } }
  }) : [];
  const closedThisMonth = closedWonStage ? await prisma.deal.aggregate({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: mStart, lte: mEnd } },
    _sum: { revenue: true }
  }) : { _sum: { revenue: null } };
  const openDealsCount = await prisma.deal.count({
    where: { bdId, isClosed: false }
  });
  const negotiationValue = negotiationStage ? await prisma.deal.aggregate({
    where: { bdId, stageId: negotiationStage.id, isClosed: false },
    _sum: { revenue: true }
  }) : { _sum: { revenue: null } };
  const activeDeals = await prisma.deal.findMany({
    where: { bdId, isClosed: false },
    include: {
      stage: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
      auditLogs: { where: { exitedAt: null }, take: 1 }
    }
  });
  const pipelineByStage = await prisma.deal.groupBy({
    by: ["stageId"],
    where: { bdId, isClosed: false },
    _count: { id: true },
    _sum: { revenue: true }
  });
  const sixMonthsAgo = /* @__PURE__ */ new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const recentWins = closedWonStage ? await prisma.deal.findMany({
    where: { bdId, stageId: closedWonStage.id, closedDate: { gte: sixMonthsAgo } },
    select: { revenue: true, closedDate: true }
  }) : [];
  const actualRevenue = closedDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const quota = Number(quarterTarget?.quota ?? 0);
  const monthlyQuota = Number(monthTarget?.quota ?? 0);
  const monthlyActual = Number(closedThisMonth._sum.revenue ?? 0);
  const negotiation = Number(negotiationValue._sum.revenue ?? 0);
  const salesForecast = actualRevenue + negotiation;
  const forecastMonths = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    forecastMonths.push({
      label: d.toLocaleString("en-PH", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      monthNum: d.getMonth()
    });
  }
  const pipelineDeals = await prisma.deal.findMany({
    where: { bdId, isClosed: false },
    select: {
      monthlySubscription: true,
      startDate: true,
      dueDate: true,
      stage: { select: { name: true } }
    }
  });
  const negotiationDeals = pipelineDeals.filter((d) => d.stage.name === STAGE.NEGOTIATION);
  const otherPipelineDeals = pipelineDeals.filter(
    (d) => d.stage.name !== STAGE.NEGOTIATION && d.stage.name !== STAGE.PROPOSAL_SENT
  );
  const allPayments = await prisma.payment.findMany({
    where: { deal: { bdId } },
    select: {
      amount: true,
      date: { select: { year: true, monthNumber: true } },
      deal: { select: { stage: { select: { name: true } } } }
    }
  });
  const monthlyForecast = forecastMonths.map(({ label, year: year2, monthNum }) => {
    const calMonth = monthNum + 1;
    const actual = allPayments.filter(
      (p) => p.deal.stage.name === STAGE.CLOSED_WON && p.date?.year === year2 && p.date?.monthNumber === calMonth
    ).reduce((s, p) => s + Number(p.amount), 0);
    const negotiation2 = negotiationDeals.filter((d) => {
      if (!d.startDate) return false;
      const start = new Date(d.startDate);
      const end = d.dueDate ? new Date(d.dueDate) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const monthStart = new Date(year2, monthNum, 1);
      const monthEnd = new Date(year2, monthNum + 1, 0);
      return start <= monthEnd && end >= monthStart;
    }).reduce((s, d) => s + Number(d.monthlySubscription ?? 0), 0);
    return {
      month: label,
      actual: Math.round(actual),
      negotiation: Math.round(negotiation2)
    };
  });
  const stuckDeals = activeDeals.map((deal) => {
    const log = deal.auditLogs[0];
    const days = log ? getDaysSince(log.enteredAt) : 0;
    const maxDays = deal.stage.duration;
    return { ...deal, daysInStage: days, isStuck: maxDays !== null && days > maxDays };
  }).filter((d) => d.isStuck);
  logger.info("BD dashboard computed", { bdId, quarter, year });
  return {
    status: 200,
    body: {
      period: { year, quarter, start: qStart, end: qEnd },
      metrics: {
        dealsClosedWon: closedDeals.length,
        openDeals: openDealsCount,
        actualRevenue,
        quota,
        quotaAttainmentPct: quota > 0 ? Math.round(actualRevenue / quota * 100) : 0,
        salesForecast,
        salesVariance: quota - actualRevenue,
        monthlyQuota,
        monthlyActual,
        monthlyExcessDeficit: monthlyActual - monthlyQuota,
        quarterlyExcessDeficit: actualRevenue - quota
      },
      pipelineByStage,
      stuckDeals,
      revenueTrend: recentWins,
      monthlyForecast
    }
  };
};

// steps/api/contacts/update.step.ts
import { z as z6 } from "zod";
var bodySchema6 = z6.object({
  firstName: z6.string().min(1).max(30).optional(),
  lastName: z6.string().min(1).max(30).optional(),
  email: z6.string().email().max(100).optional(),
  number: z6.string().max(15).optional(),
  designation: z6.string().max(100).optional(),
  decisionRank: z6.enum(["TIER_1_ECONOMIC_BUYER", "TIER_2_DECISION_MAKER", "TIER_3_INFLUENCER", "TIER_4_END_USER", "TIER_5_GATEKEEPER"]).optional(),
  isPrimary: z6.boolean().optional()
});
var config39 = {
  name: "UpdateContact",
  description: "Update an existing contact",
  triggers: [{ type: "http", path: "/api/contacts/:id", method: "PATCH", bodySchema: bodySchema6 }],
  enqueues: [],
  flows: ["contacts"]
};
var handler39 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const contact = await prisma.contact.update({ where: { id }, data: req.body });
  logger.info("Contact updated", { contactId: id });
  return { status: 200, body: { contact } };
};

// steps/api/contacts/list.step.ts
var config40 = {
  name: "GetContacts",
  description: "List contacts with optional filters by client or decision rank",
  triggers: [{ type: "http", path: "/api/contacts", method: "GET" }],
  enqueues: [],
  flows: ["contacts"]
};
var handler40 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const contacts = await prisma.contact.findMany({
    where: {
      clientId: q.client_id || void 0,
      decisionRank: q.decision_rank || void 0
    },
    include: { client: { select: { id: true, name: true, accountType: true } } },
    orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }]
  });
  logger.info("Contacts fetched", { count: contacts.length });
  return { status: 200, body: { contacts } };
};

// steps/api/contacts/get.step.ts
var config41 = {
  name: "GetContact",
  description: "Get a single contact by ID",
  triggers: [{ type: "http", path: "/api/contacts/:id", method: "GET" }],
  enqueues: [],
  flows: ["contacts"]
};
var handler41 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return { status: 404, body: { error: "Contact not found" } };
  return { status: 200, body: { contact } };
};

// steps/api/contacts/delete.step.ts
import { z as z7 } from "zod";
var bodySchema7 = z7.object({
  firstName: z7.string().min(1).max(30).optional(),
  lastName: z7.string().min(1).max(30).optional(),
  email: z7.string().email().max(100).optional(),
  number: z7.string().max(15).optional(),
  designation: z7.string().max(100).optional(),
  decisionRank: z7.enum(["TIER_1_ECONOMIC_BUYER", "TIER_2_DECISION_MAKER", "TIER_3_INFLUENCER", "TIER_4_END_USER", "TIER_5_GATEKEEPER"]).optional(),
  isPrimary: z7.boolean().optional()
});
var config42 = {
  name: "UpdateContact",
  description: "Update an existing contact",
  triggers: [{ type: "http", path: "/api/contacts/:id", method: "PATCH", bodySchema: bodySchema7 }],
  enqueues: [],
  flows: ["contacts"]
};
var handler42 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const contact = await prisma.contact.update({ where: { id }, data: req.body });
  logger.info("Contact updated", { contactId: id });
  return { status: 200, body: { contact } };
};

// steps/api/contacts/create.step.ts
import { z as z8 } from "zod";
var bodySchema8 = z8.object({
  firstName: z8.string().min(1).max(30),
  lastName: z8.string().min(1).max(30),
  email: z8.string().email().max(100),
  number: z8.string().max(15).optional(),
  designation: z8.string().max(100).optional(),
  decisionRank: z8.enum([
    "TIER_1_ECONOMIC_BUYER",
    "TIER_2_DECISION_MAKER",
    "TIER_3_INFLUENCER",
    "TIER_4_END_USER",
    "TIER_5_GATEKEEPER"
  ]),
  isPrimary: z8.boolean().default(false),
  clientId: z8.uuid()
});
var config43 = {
  name: "CreateContact",
  description: "Create a new contact linked to a client",
  triggers: [{ type: "http", path: "/api/contacts", method: "POST", bodySchema: bodySchema8 }],
  enqueues: [],
  flows: ["contacts"]
};
var handler43 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const contact = await prisma.contact.create({ data: req.body });
  logger.info("Contact created", { contactId: contact.id });
  return { status: 201, body: { contact } };
};

// steps/api/clients/update.step.ts
import { z as z9 } from "zod";
var bodySchema9 = z9.object({
  name: z9.string().min(1).max(100).optional(),
  brand: z9.string().max(100).optional(),
  accountType: z9.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]).optional(),
  status: z9.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
  industryId: z9.string().uuid().optional()
});
var config44 = {
  name: "UpdateClient",
  description: "Update an existing client",
  triggers: [{ type: "http", path: "/api/clients/:id", method: "PATCH", bodySchema: bodySchema9 }],
  enqueues: [],
  flows: ["clients"]
};
var handler44 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const { industryId, ...rest } = req.body;
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...industryId ? { industry: { connect: { id: industryId } } } : {}
    },
    include: { industry: true }
  });
  logger.info("Client updated", { clientId: id });
  return { status: 200, body: { client } };
};

// steps/api/clients/list.step.ts
var config45 = {
  name: "GetClients",
  description: "List all clients with optional filters",
  triggers: [{ type: "http", path: "/api/clients", method: "GET" }],
  enqueues: [],
  flows: ["clients"]
};
var handler45 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const q = req.queryParams;
  const clients = await prisma.client.findMany({
    where: {
      accountType: q.account_type || void 0,
      status: q.status || void 0,
      industryId: q.industry_id || void 0
    },
    include: {
      industry: { select: { id: true, name: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
      _count: { select: { deals: true, contacts: true } }
    },
    orderBy: { name: "asc" }
  });
  logger.info("Clients fetched", { count: clients.length });
  return { status: 200, body: { clients } };
};

// steps/api/clients/get.step.ts
var config46 = {
  name: "GetClient",
  description: "Get a single client by ID with contacts and deals",
  triggers: [{ type: "http", path: "/api/clients/:id", method: "GET" }],
  enqueues: [],
  flows: ["clients"]
};
var handler46 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      industry: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      deals: { select: { id: true, dealName: true, isClosed: true, stage: { select: { name: true } } } }
    }
  });
  if (!client) return { status: 404, body: { error: "Client not found" } };
  logger.info("Client fetched", { clientId: id });
  return { status: 200, body: { client } };
};

// steps/api/clients/delete.step.ts
var config47 = {
  name: "DeleteClient",
  description: "Delete a client",
  triggers: [{ type: "http", path: "/api/clients/:id", method: "DELETE" }],
  enqueues: [],
  flows: ["clients"]
};
var handler47 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { id } = req.pathParams;
  await prisma.client.delete({ where: { id } });
  logger.info("Client deleted", { clientId: id });
  return { status: 200, body: { success: true } };
};

// steps/api/clients/create.step.ts
import { z as z10 } from "zod";
var bodySchema10 = z10.object({
  name: z10.string().min(1).max(100),
  brand: z10.string().max(100).optional(),
  accountType: z10.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]),
  status: z10.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
  industryId: z10.string().uuid().optional()
});
var config48 = {
  name: "CreateClient",
  description: "Create a new client account",
  triggers: [{ type: "http", path: "/api/clients", method: "POST", bodySchema: bodySchema10 }],
  enqueues: [],
  flows: ["clients"]
};
var handler48 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const { industryId, ...rest } = req.body;
  const client = await prisma.client.create({
    data: {
      ...rest,
      ...industryId ? { industry: { connect: { id: industryId } } } : {}
    },
    include: { industry: true }
  });
  logger.info("Client created", { clientId: client.id });
  return { status: 201, body: { client } };
};

// steps/api/bundles/Bundles.step.ts
var config49 = {
  name: "BundlesList",
  description: "List all bundles with their services",
  triggers: [{ type: "http", path: "/api/bundles", method: "GET" }],
  enqueues: [],
  flows: ["services"]
};
var handler49 = async (req, { logger }) => {
  const { error, status } = await authenticate(req);
  if (error) return { status, body: { error } };
  const bundles = await prisma.bundle.findMany({
    include: { bundleServices: { include: { service: true } } },
    orderBy: { name: "asc" }
  });
  logger.info("Bundles listed", { count: bundles.length });
  return { status: 200, body: { bundles } };
};

// steps/api/auth/me.step.ts
var config50 = {
  name: "AuthMe",
  description: "Return the authenticated user profile",
  triggers: [{ type: "http", path: "/api/auth/me", method: "GET" }],
  enqueues: [],
  flows: ["auth"]
};
var handler50 = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req);
  if (error) return { status, body: { error } };
  logger.info("Me fetched", { userId: user.id });
  return { status: 200, body: { user } };
};

// steps/api/auth/login.step.ts
import { z as z11 } from "zod";
import bcrypt from "bcrypt";
var config51 = {
  name: "AuthLogin",
  description: "Authenticate a BD member and return a JWT token",
  triggers: [
    {
      type: "http",
      path: "/api/auth/login",
      method: "POST",
      bodySchema: z11.object({ email: z11.string().email(), password: z11.string().min(1) })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler51 = async (req, { logger }) => {
  const { email, password } = req.body;
  const user = await prisma.bD.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return { status: 401, body: { error: "Invalid credentials" } };
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return { status: 401, body: { error: "Invalid credentials" } };
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  logger.info("User logged in", { userId: user.id });
  return {
    status: 200,
    body: {
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    }
  };
};

// index-dev.js
initIII();
var motia = new Motia();
motia.addStep(config, "./steps/events/onLeadAssigned.step.ts", handler, "./steps/events/onLeadAssigned.step.ts");
motia.addStep(config2, "./steps/events/onDealUpdated.step.ts", handler2, "./steps/events/onDealUpdated.step.ts");
motia.addStep(config3, "./steps/events/onDealStageChanged.step.ts", handler3, "./steps/events/onDealStageChanged.step.ts");
motia.addStep(config4, "./steps/events/onDealCreated.step.ts", handler4, "./steps/events/onDealCreated.step.ts");
motia.addStep(config5, "./steps/events/onDealClosedWon.step.ts", handler5, "./steps/events/onDealClosedWon.step.ts");
motia.addStep(config6, "./steps/events/onDealClosedLost.step.ts", handler6, "./steps/events/onDealClosedLost.step.ts");
motia.addStep(config7, "./steps/cron/weeklyForecastSnapshot.step.ts", handler7, "./steps/cron/weeklyForecastSnapshot.step.ts");
motia.addStep(config8, "./steps/cron/checkStuckDeals.step.ts", handler8, "./steps/cron/checkStuckDeals.step.ts");
motia.addStep(config9, "./steps/cron/checkQuotaPacing.step.ts", handler9, "./steps/cron/checkQuotaPacing.step.ts");
motia.addStep(config10, "./steps/cron/checkLostDealFollowUp.step.ts", handler10, "./steps/cron/checkLostDealFollowUp.step.ts");
motia.addStep(config11, "./steps/cron/checkFollowUpDue.step.ts", handler11, "./steps/cron/checkFollowUpDue.step.ts");
motia.addStep(config12, "./steps/cron/checkActionPlanDue.step.ts", handler12, "./steps/cron/checkActionPlanDue.step.ts");
motia.addStep(config13, "./steps/api/services/List.step.ts", handler13, "./steps/api/services/List.step.ts");
motia.addStep(config14, "./steps/api/reports/winloss.step.ts", handler14, "./steps/api/reports/winloss.step.ts");
motia.addStep(config15, "./steps/api/reports/services.step.ts", handler15, "./steps/api/reports/services.step.ts");
motia.addStep(config16, "./steps/api/reports/salesCycle.step.ts", handler16, "./steps/api/reports/salesCycle.step.ts");
motia.addStep(config17, "./steps/api/reports/quota.step.ts", handler17, "./steps/api/reports/quota.step.ts");
motia.addStep(config18, "./steps/api/reports/pipeline.step.ts", handler18, "./steps/api/reports/pipeline.step.ts");
motia.addStep(config19, "./steps/api/reports/growth.step.ts", handler19, "./steps/api/reports/growth.step.ts");
motia.addStep(config20, "./steps/api/reports/breakdown.step.ts", handler20, "./steps/api/reports/breakdown.step.ts");
motia.addStep(config21, "./steps/api/pipelineStages/list.step.ts", handler21, "./steps/api/pipelineStages/list.step.ts");
motia.addStep(config22, "./steps/api/payments/update.step.ts", handler22, "./steps/api/payments/update.step.ts");
motia.addStep(config23, "./steps/api/payments/list.step.ts", handler23, "./steps/api/payments/list.step.ts");
motia.addStep(config24, "./steps/api/payments/delete.step.ts", handler24, "./steps/api/payments/delete.step.ts");
motia.addStep(config25, "./steps/api/payments/create.step.ts", handler25, "./steps/api/payments/create.step.ts");
motia.addStep(config26, "./steps/api/notifications/markRead.step.ts", handler26, "./steps/api/notifications/markRead.step.ts");
motia.addStep(config27, "./steps/api/notifications/markAllRead.step.ts", handler27, "./steps/api/notifications/markAllRead.step.ts");
motia.addStep(config28, "./steps/api/notifications/list.step.ts", handler28, "./steps/api/notifications/list.step.ts");
motia.addStep(config29, "./steps/api/industries/Industries.step.ts", handler29, "./steps/api/industries/Industries.step.ts");
motia.addStep(config30, "./steps/api/deals/update.step.ts", handler30, "./steps/api/deals/update.step.ts");
motia.addStep(config31, "./steps/api/deals/stage.step.ts", handler31, "./steps/api/deals/stage.step.ts");
motia.addStep(config32, "./steps/api/deals/list.step.ts", handler32, "./steps/api/deals/list.step.ts");
motia.addStep(config33, "./steps/api/deals/history.step.ts", handler33, "./steps/api/deals/history.step.ts");
motia.addStep(config34, "./steps/api/deals/get.step.ts", handler34, "./steps/api/deals/get.step.ts");
motia.addStep(config35, "./steps/api/deals/delete.step.ts", handler35, "./steps/api/deals/delete.step.ts");
motia.addStep(config36, "./steps/api/deals/create.step.ts", handler36, "./steps/api/deals/create.step.ts");
motia.addStep(config37, "./steps/api/dashboard/executive.step.ts", handler37, "./steps/api/dashboard/executive.step.ts");
motia.addStep(config38, "./steps/api/dashboard/bd.step.ts", handler38, "./steps/api/dashboard/bd.step.ts");
motia.addStep(config39, "./steps/api/contacts/update.step.ts", handler39, "./steps/api/contacts/update.step.ts");
motia.addStep(config40, "./steps/api/contacts/list.step.ts", handler40, "./steps/api/contacts/list.step.ts");
motia.addStep(config41, "./steps/api/contacts/get.step.ts", handler41, "./steps/api/contacts/get.step.ts");
motia.addStep(config42, "./steps/api/contacts/delete.step.ts", handler42, "./steps/api/contacts/delete.step.ts");
motia.addStep(config43, "./steps/api/contacts/create.step.ts", handler43, "./steps/api/contacts/create.step.ts");
motia.addStep(config44, "./steps/api/clients/update.step.ts", handler44, "./steps/api/clients/update.step.ts");
motia.addStep(config45, "./steps/api/clients/list.step.ts", handler45, "./steps/api/clients/list.step.ts");
motia.addStep(config46, "./steps/api/clients/get.step.ts", handler46, "./steps/api/clients/get.step.ts");
motia.addStep(config47, "./steps/api/clients/delete.step.ts", handler47, "./steps/api/clients/delete.step.ts");
motia.addStep(config48, "./steps/api/clients/create.step.ts", handler48, "./steps/api/clients/create.step.ts");
motia.addStep(config49, "./steps/api/bundles/Bundles.step.ts", handler49, "./steps/api/bundles/Bundles.step.ts");
motia.addStep(config50, "./steps/api/auth/me.step.ts", handler50, "./steps/api/auth/me.step.ts");
motia.addStep(config51, "./steps/api/auth/login.step.ts", handler51, "./steps/api/auth/login.step.ts");
motia.authenticateStream = authenticateStream;
motia.initialize();
//# sourceMappingURL=index-dev.js.map

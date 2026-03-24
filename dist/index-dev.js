// index-dev.js
import { Motia, initIII } from "motia";

// steps/events/onDealStageChanged.step.ts
import { logger } from "motia";
import { z } from "zod";

// lib/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

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
    await prisma.notification.create({
      data: {
        content,
        type: "STAGE_CHANGE",
        triggeredBy: "STAGE_CHANGE",
        bdId: data.bdId,
        dealId: data.dealId
      }
    });
    if (data.changedById !== data.bdId) {
      await prisma.notification.create({
        data: {
          content: `You moved "${data.dealName}" from ${data.previousStageName} to ${data.newStageName}.`,
          type: "STAGE_CHANGE",
          triggeredBy: "STAGE_CHANGE",
          bdId: data.changedById,
          dealId: data.dealId
        }
      });
    }
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

// steps/api/pipelineStages/list.step.ts
import { logger as logger2 } from "motia";

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

// steps/api/pipelineStages/list.step.ts
var config2 = {
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
var handler2 = async (req) => {
  try {
    await authenticate(req.request);
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { name: "asc" }
      // will be sorted by a fixed order on frontend
    });
    logger2.info("Pipeline stages fetched", { count: stages.length });
    return { status: 200, body: stages };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger2.error("Failed to fetch pipeline stages", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/markRead.step.ts
import { logger as logger3 } from "motia";
var config3 = {
  name: "MarkNotificationRead",
  description: "Mark a single notification as read",
  triggers: [
    // Path matches frontend: apiClient.patch(`/notifications/${id}/read`)
    { type: "http", method: "PATCH", path: "/notifications/:id/read" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler3 = async (req, ctx) => {
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
    logger3.error("Failed to mark notification read", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/markAllRead.step.ts
import { logger as logger4 } from "motia";
var config4 = {
  name: "MarkAllNotificationsRead",
  description: "Mark all of the authenticated user's notifications as read",
  triggers: [
    // Path matches frontend: apiClient.post('/notifications/read-all')
    { type: "http", method: "POST", path: "/notifications/read-all" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler4 = async (req, ctx) => {
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
    logger4.error("Failed to mark all notifications read", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/notifications/list.step.ts
import { logger as logger5 } from "motia";
var config5 = {
  name: "ListNotifications",
  description: "List notifications for the authenticated BD member with unread count (FR-ADD-010)",
  triggers: [
    // Path matches frontend api/notifications.ts: apiClient.get('/notifications')
    { type: "http", method: "GET", path: "/notifications" }
  ],
  enqueues: [],
  flows: ["notification-system"]
};
var handler5 = async (req, ctx) => {
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
    logger5.error("Failed to list notifications", { error: error.message });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/updateStage.step.ts
import { logger as logger6, enqueue } from "motia";
import { z as z2 } from "zod";
import { Prisma } from "@prisma/client";
var STAGE_PROBABILITY = {
  "Inquiry": 10,
  "Prospecting": 20,
  "Discovery": 40,
  "Proposal Sent": 60,
  "Negotiation": 75,
  "Closed Won": 100,
  "Closed Lost": 0
};
var config6 = {
  name: "UpdateDealStage",
  description: "Move a deal to a new pipeline stage with atomic audit log tracking (FR-D07 to FR-D11)",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/deals/:id/stage",
      bodySchema: z2.object({
        stageId: z2.string().uuid(),
        remarks: z2.string().min(1, "Remarks are required when moving a deal"),
        actionPlan: z2.string().min(1, "Action plan is required when moving a deal"),
        notes: z2.string().optional()
      })
    }
  ],
  enqueues: ["deal.stage.changed"],
  flows: ["sales-pipeline"]
};
var handler6 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const { stageId, remarks, actionPlan, notes } = req.request.body;
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
    const isClosed = ["Closed Won", "Closed Lost"].includes(targetStage.name);
    const newProbability = STAGE_PROBABILITY[targetStage.name] ?? 0;
    const updatedDeal = await prisma.$transaction(async (tx) => {
      await tx.dealAuditLog.updateMany({
        where: { dealId: id, exitedAt: null },
        data: { exitedAt: /* @__PURE__ */ new Date() }
      });
      const auditNote = [
        notes || `Moved from ${deal.stage.name} to ${targetStage.name}`,
        `Remarks: ${remarks}`,
        `Action Plan: ${actionPlan}`
      ].join("\n");
      await tx.dealAuditLog.create({
        data: {
          dealId: id,
          stageId,
          changedById: user.id,
          enteredAt: /* @__PURE__ */ new Date(),
          notes: auditNote
        }
      });
      const dealUpdateData = {
        stage: { connect: { id: stageId } },
        remarks,
        actionPlan,
        lastStageUpdateAt: /* @__PURE__ */ new Date(),
        isClosed,
        ...isClosed && { closedDate: /* @__PURE__ */ new Date() },
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
          bundle: true
        }
      });
      await tx.dealProjection.updateMany({
        where: { dealId: id },
        data: {
          probabilityPct: newProbability,
          weightedValue: Number(deal.revenue || 0) * (newProbability / 100)
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
    logger6.info("Deal stage updated", {
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Record not found or invalid reference" } };
    }
    logger6.error("Failed to update deal stage", {
      error: error.message,
      dealId: req.request.pathParams.id
    });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/update.step.ts
import { logger as logger7 } from "motia";
import { z as z3 } from "zod";
import { Prisma as Prisma2 } from "@prisma/client";
var config7 = {
  name: "UpdateDeal",
  description: "Update an existing deal",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/deals/:id",
      bodySchema: z3.object({
        dealName: z3.string().min(1).optional(),
        monthlySubscription: z3.number().min(0).optional(),
        duration: z3.number().min(1).optional(),
        stageId: z3.string().uuid().optional(),
        remarks: z3.string().optional(),
        actionPlan: z3.string().optional(),
        dueDate: z3.string().datetime().optional(),
        proposalLink: z3.string().url().optional(),
        contractLink: z3.string().url().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler7 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const { stageId, remarks, monthlySubscription, duration, ...rest } = req.request.body;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { stage: true }
    });
    if (!deal) {
      return { status: 404, body: { error: "Deal not found" } };
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
    if (targetStageName === "Closed Lost" && !remarks && !deal.remarks) {
      return {
        status: 400,
        body: { error: "Remarks (Loss Reason) are required when closing a deal as lost" }
      };
    }
    const updateData = {
      ...rest,
      remarks: remarks || deal.remarks
    };
    if (monthlySubscription !== void 0 || duration !== void 0) {
      const newMonthly = monthlySubscription ?? Number(deal.monthlySubscription);
      const newDuration = duration ?? deal.duration;
      updateData.monthlySubscription = newMonthly;
      updateData.duration = newDuration;
      updateData.revenue = newMonthly * newDuration;
    }
    if (stageId && stageId !== deal.stageId) {
      updateData.stageId = stageId;
      updateData.lastStageUpdateAt = /* @__PURE__ */ new Date();
      if (targetStageName === "Closed Won" || targetStageName === "Closed Lost") {
        updateData.isClosed = true;
        updateData.closedDate = /* @__PURE__ */ new Date();
      } else {
        updateData.isClosed = false;
        updateData.closedDate = null;
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
          }
        }
      });
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
            notes: remarks || `Moved from ${deal.stage.name} to ${targetStageName}`
          }
        });
      }
      return updated;
    });
    logger7.info("Updated deal", { dealId: id, by: user.id });
    return {
      status: 200,
      body: updatedDeal
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma2.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Record not found or invalid ID provided" } };
    }
    logger7.error("Failed to update deal", { error: error.message, dealId: req.request.pathParams.id });
    return {
      status: 500,
      body: { error: "Internal server error" }
    };
  }
};

// steps/api/deals/list.step.ts
import { logger as logger8 } from "motia";
var config8 = {
  name: "ListDeals",
  description: "Get list of all deals",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler8 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger8.info("Listing deals", { userId: user.id });
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
    logger8.error("Failed to list deals", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/history.step.ts
import { logger as logger9 } from "motia";
var config9 = {
  name: "GetDealHistory",
  description: "Get full stage transition history for a deal (FR-ADD-002)",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals/:id/history" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler9 = async (req, ctx) => {
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
    const enriched = history.map((entry) => {
      const exitTime = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now();
      const enterTime = new Date(entry.enteredAt).getTime();
      const daysInStage = Math.floor((exitTime - enterTime) / 864e5);
      return {
        id: entry.id,
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
    return { status: 200, body: enriched };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    logger9.error("Failed to get deal history", { error: error.message, dealId: req.request.pathParams.id });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/get.step.ts
import { logger as logger10 } from "motia";
var config10 = {
  name: "GetDeal",
  description: "Get a single deal by ID with full details (supports DealDetail page)",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler10 = async (req, ctx) => {
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
            }
          }
        },
        service: true,
        bundle: true,
        projection: true,
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
    logger10.error("Failed to get deal", { error: error.message, dealId: req.request.pathParams.id });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/create.step.ts
import { logger as logger11 } from "motia";
import { z as z4 } from "zod";
import { Prisma as Prisma3 } from "@prisma/client";
var config11 = {
  name: "CreateDeal",
  description: "Create a new deal",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/deals",
      bodySchema: z4.object({
        dealName: z4.string().min(1),
        clientId: z4.string().min(1),
        monthlySubscription: z4.number().min(0),
        duration: z4.number().min(1),
        leadSource: z4.enum(["INBOUND", "OUTBOUND", "REFERRAL"]),
        serviceId: z4.string().optional(),
        bundleId: z4.string().optional(),
        proposalLink: z4.string().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler11 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { dealName, clientId, monthlySubscription, duration, leadSource, serviceId, bundleId, proposalLink } = req.request.body;
    const inquiryStage = await prisma.pipelineStage.findUnique({
      where: { name: "Inquiry" }
    });
    if (!inquiryStage) {
      return { status: 500, body: { error: "Inquiry stage not found in DB." } };
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
        startDate: /* @__PURE__ */ new Date(),
        lastStageUpdateAt: /* @__PURE__ */ new Date(),
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
        bundle: true
      }
    });
    logger11.info("Created new deal", { dealId: newDeal.id, bdId: user.id });
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
    if (error instanceof Prisma3.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        status: 400,
        body: { error: "Related record not found \u2014 check bdMemberId, clientId, serviceIds, etc." }
      };
    }
    logger11.error("Failed to create deal", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/update.step.ts
import { logger as logger12 } from "motia";
import { z as z5 } from "zod";
import { Prisma as Prisma4 } from "@prisma/client";
var config12 = {
  name: "UpdateContact",
  description: "Update an existing contact",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/contacts/:id",
    bodySchema: z5.object({
      firstName: z5.string().min(1).optional(),
      lastName: z5.string().min(1).optional(),
      email: z5.string().email().optional(),
      phone: z5.string().optional(),
      jobTitle: z5.string().optional(),
      decisionMakerTier: z5.number().min(1).max(5).optional(),
      isPrimary: z5.boolean().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler12 = async (req, ctx) => {
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
    logger12.info("Contact updated", { contactId: id, by: user.id });
    return { status: 200, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma4.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: 404, body: { error: "Contact not found" } };
    }
    logger12.error("Failed to update contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/list.step.ts
import { logger as logger13 } from "motia";
var config13 = {
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
var handler13 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger13.info("Listing contacts", { userId: user.id });
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
    logger13.error("Failed to list contacts", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/create.step.ts
import { logger as logger14 } from "motia";
import { z as z6 } from "zod";
import { Prisma as Prisma5 } from "@prisma/client";
var config14 = {
  name: "CreateContact",
  description: "Create a new contact",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/contacts",
    bodySchema: z6.object({
      firstName: z6.string().min(1),
      lastName: z6.string().min(1),
      email: z6.string().email(),
      // email is required in the DB
      phone: z6.string().optional(),
      // maps to 'number' in DB
      jobTitle: z6.string().optional(),
      // maps to 'designation' in DB
      decisionMakerTier: z6.number().min(1).max(5).default(3),
      clientId: z6.string().min(1),
      isPrimary: z6.boolean().default(false)
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler14 = async (req, ctx) => {
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
    logger14.info("Contact created", { contactId: contact.id, by: user.id });
    return { status: 201, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma5.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Client not found \u2014 check clientId" } };
    }
    if (error instanceof Prisma5.PrismaClientValidationError || error instanceof Prisma5.PrismaClientKnownRequestError && error.code === "P2000") {
      return { status: 400, body: { error: "Invalid input \u2014 check field lengths and types" } };
    }
    logger14.error("Failed to create contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/update.step.ts
import { logger as logger15 } from "motia";
import { z as z7 } from "zod";
import { Prisma as Prisma6 } from "@prisma/client";
var config15 = {
  name: "UpdateClient",
  description: "Update an existing client",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/clients/:id",
    bodySchema: z7.object({
      name: z7.string().min(1).optional(),
      // all optional for partial update
      brand: z7.string().optional(),
      accountType: z7.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]).optional(),
      status: z7.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
      industryId: z7.string().optional(),
      contactId: z7.string().optional()
      // set primary contact
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler15 = async (req, ctx) => {
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
    logger15.info("Client updated", { clientId: id, by: user.id });
    return { status: 200, body: updated };
  } catch (error) {
    logger15.error("Failed to update client", { error: error.message, clientId: req.request.pathParams?.id });
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma6.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
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
import { logger as logger16 } from "motia";
var config16 = {
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
var handler16 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger16.info("Listing clients", { userId: user.id });
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
    logger16.error("Failed to list clients", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/detail.step.ts
import { logger as logger17 } from "motia";
var config17 = {
  name: "GetClientDetail",
  description: "Get a single client by ID",
  triggers: [
    { type: "http", method: "GET", path: "/api/clients/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler17 = async (req, ctx) => {
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
    logger17.error("Failed to get client details", { error: error.message, clientId: req.request.pathParams.id });
    return {
      status: error.name === "AuthError" ? 401 : 500,
      body: { error: error.message || "Internal Server Error" }
    };
  }
};

// steps/api/clients/create.step.ts
import { logger as logger18 } from "motia";
import { z as z8 } from "zod";
import { Prisma as Prisma7 } from "@prisma/client";
var config18 = {
  name: "CreateClient",
  description: "Create a new client",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/clients",
    bodySchema: z8.object({
      // Zod validates BEFORE handler runs
      name: z8.string().min(1),
      // required
      brand: z8.string().optional(),
      accountType: z8.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]),
      status: z8.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
      industryId: z8.string().optional(),
      referralId: z8.string().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler18 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { name, brand, accountType, status, industryId, referralId } = req.request.body;
    const client = await prisma.client.create({
      data: { name, brand, accountType, status, industryId, referralId },
      include: { industry: true, contacts: true }
    });
    logger18.info("Client created", { clientId: client.id, by: user.id });
    return { status: 201, body: client };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma7.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { status: 400, body: { error: "Related record not found (check industryId, referralId)" } };
    }
    logger18.error("Failed to create client", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/auth/me.step.ts
import { logger as logger19 } from "motia";
var config19 = {
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
var handler19 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger19.info("Auth check successful", { userId: user.id });
    return {
      status: 200,
      body: { user }
    };
  } catch (error) {
    logger19.warn("Auth check failed", { error: error.message });
    return {
      status: 401,
      body: { error: "Not authenticated" }
    };
  }
};

// steps/api/auth/login.step.ts
import { logger as logger20 } from "motia";
import { z as z9 } from "zod";
import bcrypt from "bcrypt";
var config20 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z9.object({
        email: z9.string().email(),
        password: z9.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler20 = async (req, ctx) => {
  const { email, password } = req.request.body;
  logger20.info("Login attempt", { email });
  const bd = await prisma.bD.findUnique({
    where: { email }
  });
  if (!bd) {
    logger20.warn("Login failed - user not found", { email });
    return {
      status: 401,
      body: { error: "Invalid email or password" }
    };
  }
  if (!bd.isActive) {
    logger20.warn("Login failed - account deactivated", { email });
    return {
      status: 401,
      body: { error: "Account is deactivated" }
    };
  }
  const passwordValid = await bcrypt.compare(password, bd.password);
  if (!passwordValid) {
    logger20.warn("Login failed - wrong password", { email });
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
  logger20.info("Login successful", { email, role: bd.role });
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
motia.addStep(config2, "./steps/api/pipelineStages/list.step.ts", handler2, "./steps/api/pipelineStages/list.step.ts");
motia.addStep(config3, "./steps/api/notifications/markRead.step.ts", handler3, "./steps/api/notifications/markRead.step.ts");
motia.addStep(config4, "./steps/api/notifications/markAllRead.step.ts", handler4, "./steps/api/notifications/markAllRead.step.ts");
motia.addStep(config5, "./steps/api/notifications/list.step.ts", handler5, "./steps/api/notifications/list.step.ts");
motia.addStep(config6, "./steps/api/deals/updateStage.step.ts", handler6, "./steps/api/deals/updateStage.step.ts");
motia.addStep(config7, "./steps/api/deals/update.step.ts", handler7, "./steps/api/deals/update.step.ts");
motia.addStep(config8, "./steps/api/deals/list.step.ts", handler8, "./steps/api/deals/list.step.ts");
motia.addStep(config9, "./steps/api/deals/history.step.ts", handler9, "./steps/api/deals/history.step.ts");
motia.addStep(config10, "./steps/api/deals/get.step.ts", handler10, "./steps/api/deals/get.step.ts");
motia.addStep(config11, "./steps/api/deals/create.step.ts", handler11, "./steps/api/deals/create.step.ts");
motia.addStep(config12, "./steps/api/contacts/update.step.ts", handler12, "./steps/api/contacts/update.step.ts");
motia.addStep(config13, "./steps/api/contacts/list.step.ts", handler13, "./steps/api/contacts/list.step.ts");
motia.addStep(config14, "./steps/api/contacts/create.step.ts", handler14, "./steps/api/contacts/create.step.ts");
motia.addStep(config15, "./steps/api/clients/update.step.ts", handler15, "./steps/api/clients/update.step.ts");
motia.addStep(config16, "./steps/api/clients/list.step.ts", handler16, "./steps/api/clients/list.step.ts");
motia.addStep(config17, "./steps/api/clients/detail.step.ts", handler17, "./steps/api/clients/detail.step.ts");
motia.addStep(config18, "./steps/api/clients/create.step.ts", handler18, "./steps/api/clients/create.step.ts");
motia.addStep(config19, "./steps/api/auth/me.step.ts", handler19, "./steps/api/auth/me.step.ts");
motia.addStep(config20, "./steps/api/auth/login.step.ts", handler20, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

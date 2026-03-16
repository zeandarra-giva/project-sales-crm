// index-dev.js
import { Motia, initIII } from "motia";

// steps/api/deals/update.step.ts
import { logger } from "motia";
import { z } from "zod";

// lib/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

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

// steps/api/deals/update.step.ts
import { Prisma } from "@prisma/client";
var config = {
  name: "UpdateDeal",
  description: "Update an existing deal",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/deals/:id",
      bodySchema: z.object({
        dealName: z.string().min(1).optional(),
        monthlySubscription: z.number().min(0).optional(),
        duration: z.number().min(1).optional(),
        stageId: z.string().uuid().optional(),
        remarks: z.string().optional(),
        actionPlan: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        proposalLink: z.string().url().optional(),
        contractLink: z.string().url().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler = async (req, ctx) => {
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
      targetStageName = targetStage?.name || "";
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
    const updatedDeal = await prisma.deal.update({
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
      await prisma.dealAuditLog.updateMany({
        where: { dealId: id, exitedAt: null },
        data: { exitedAt: /* @__PURE__ */ new Date() }
      });
      await prisma.dealAuditLog.create({
        data: {
          dealId: id,
          stageId,
          changedById: user.id,
          enteredAt: /* @__PURE__ */ new Date(),
          notes: remarks || `Moved from ${deal.stage.name} to ${targetStageName}`
        }
      });
    }
    logger.info("Updated deal", { dealId: id, by: user.id });
    return {
      status: 200,
      body: updatedDeal
    };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: 400, body: { error: "Record not found or invalid ID provided" } };
    }
    logger.error("Failed to update deal", { error: error.message, dealId: req.request.pathParams.id });
    return {
      status: 500,
      body: { error: "Internal server error" }
    };
  }
};

// steps/api/deals/list.step.ts
import { logger as logger2 } from "motia";
var config2 = {
  name: "ListDeals",
  description: "Get list of all deals",
  triggers: [
    { type: "http", method: "GET", path: "/api/deals" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler2 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger2.info("Listing deals", { userId: user.id });
    const deals = await prisma.deal.findMany({
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
    logger2.error("Failed to list deals", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/deals/create.step.ts
import { logger as logger3 } from "motia";
import { z as z2 } from "zod";
import { Prisma as Prisma2 } from "@prisma/client";
var config3 = {
  name: "CreateDeal",
  description: "Create a new deal",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/deals",
      bodySchema: z2.object({
        dealName: z2.string().min(1),
        clientId: z2.string().min(1),
        monthlySubscription: z2.number().min(0),
        duration: z2.number().min(1),
        leadSource: z2.enum(["INBOUND", "OUTBOUND", "REFERRAL"]),
        serviceId: z2.string().optional(),
        bundleId: z2.string().optional(),
        proposalLink: z2.string().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler3 = async (req, ctx) => {
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
    logger3.info("Created new deal", { dealId: newDeal.id, bdId: user.id });
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
    if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        status: 400,
        body: { error: "Related record not found \u2014 check bdMemberId, clientId, serviceIds, etc." }
      };
    }
    logger3.error("Failed to create deal", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/update.step.ts
import { logger as logger4 } from "motia";
import { z as z3 } from "zod";
import { Prisma as Prisma3 } from "@prisma/client";
var config4 = {
  name: "UpdateContact",
  description: "Update an existing contact",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/contacts/:id",
    bodySchema: z3.object({
      firstName: z3.string().min(1).optional(),
      lastName: z3.string().min(1).optional(),
      email: z3.string().email().optional(),
      phone: z3.string().optional(),
      jobTitle: z3.string().optional(),
      decisionMakerTier: z3.number().min(1).max(5).optional(),
      isPrimary: z3.boolean().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler4 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { id } = req.request.pathParams;
    const contact = await prisma.contact.update({
      where: { id },
      data: req.request.body,
      include: { client: { select: { id: true, name: true } } }
    });
    if (req.request.body.isPrimary) {
      await prisma.client.update({
        where: { id: contact.clientId },
        data: { contactId: contact.id }
      });
    }
    logger4.info("Contact updated", { contactId: id, by: user.id });
    return { status: 200, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma3.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: 400, body: { error: "Contact not found or invalid related ID" } };
    }
    logger4.error("Failed to update contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/list.step.ts
import { logger as logger5 } from "motia";
var config5 = {
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
var handler5 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger5.info("Listing contacts", { userId: user.id });
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
    logger5.error("Failed to list contacts", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/contacts/create.step.ts
import { logger as logger6 } from "motia";
import { z as z4 } from "zod";
var config6 = {
  name: "CreateContact",
  description: "Create a new contact",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/contacts",
    bodySchema: z4.object({
      firstName: z4.string().min(1),
      lastName: z4.string().min(1),
      email: z4.string().email(),
      // email is required in the DB
      phone: z4.string().optional(),
      // maps to 'number' in DB
      jobTitle: z4.string().optional(),
      // maps to 'designation' in DB
      decisionMakerTier: z4.number().min(1).max(5).default(3),
      clientId: z4.string().min(1),
      isPrimary: z4.boolean().default(false)
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler6 = async (req, ctx) => {
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
    const contact = await prisma.contact.create({
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
      await prisma.client.update({
        where: { id: clientId },
        data: { contactId: contact.id }
      });
    }
    logger6.info("Contact created", { contactId: contact.id, by: user.id });
    return { status: 201, body: contact };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error.code === "P2002") {
      return { status: 400, body: { error: "A contact with this email already exists" } };
    }
    if (error.code === "P2025") {
      return { status: 400, body: { error: "Client not found \u2014 check clientId" } };
    }
    logger6.error("Failed to create contact", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/update.step.ts
import { logger as logger7 } from "motia";
import { z as z5 } from "zod";
import { Prisma as Prisma4 } from "@prisma/client";
var config7 = {
  name: "UpdateClient",
  description: "Update an existing client",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/clients/:id",
    bodySchema: z5.object({
      name: z5.string().min(1).optional(),
      // all optional for partial update
      brand: z5.string().optional(),
      accountType: z5.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]).optional(),
      status: z5.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
      industryId: z5.string().optional(),
      contactId: z5.string().optional()
      // set primary contact
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler7 = async (req, ctx) => {
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
    logger7.info("Client updated", { clientId: id, by: user.id });
    return { status: 200, body: updated };
  } catch (error) {
    logger7.error("Failed to update client", { error: error.message, clientId: req.request.pathParams?.id });
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma4.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
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
import { logger as logger8 } from "motia";
var config8 = {
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
var handler8 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger8.info("Listing clients", { userId: user.id });
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
    logger8.error("Failed to list clients", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/detail.step.ts
import { logger as logger9 } from "motia";
var config9 = {
  name: "GetClientDetail",
  description: "Get a single client by ID",
  triggers: [
    { type: "http", method: "GET", path: "/api/clients/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler9 = async (req, ctx) => {
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
    logger9.error("Failed to get client details", { error: error.message, clientId: req.request.pathParams.id });
    return {
      status: error.name === "AuthError" ? 401 : 500,
      body: { error: error.message || "Internal Server Error" }
    };
  }
};

// steps/api/clients/create.step.ts
import { logger as logger10 } from "motia";
import { z as z6 } from "zod";
import { Prisma as Prisma5 } from "@prisma/client";
var config10 = {
  name: "CreateClient",
  description: "Create a new client",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/clients",
    bodySchema: z6.object({
      // Zod validates BEFORE handler runs
      name: z6.string().min(1),
      // required
      brand: z6.string().optional(),
      accountType: z6.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]),
      status: z6.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
      industryId: z6.string().optional(),
      referralId: z6.string().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler10 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    const { name, brand, accountType, status, industryId, referralId } = req.request.body;
    const client = await prisma.client.create({
      data: { name, brand, accountType, status, industryId, referralId },
      include: { industry: true, contacts: true }
    });
    logger10.info("Client created", { clientId: client.id, by: user.id });
    return { status: 201, body: client };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (
      // ← Refactor 4
      error instanceof Prisma5.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")
    ) {
      return { status: 400, body: { error: "Related record not found (check industryId, referralId)" } };
    }
    logger10.error("Failed to create client", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/auth/me.step.ts
import { logger as logger11 } from "motia";
var config11 = {
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
var handler11 = async (req, ctx) => {
  try {
    const user = await authenticate(req.request);
    logger11.info("Auth check successful", { userId: user.id });
    return {
      status: 200,
      body: { user }
    };
  } catch (error) {
    logger11.warn("Auth check failed", { error: error.message });
    return {
      status: 401,
      body: { error: "Not authenticated" }
    };
  }
};

// steps/api/auth/login.step.ts
import { logger as logger12 } from "motia";
import { z as z7 } from "zod";
import bcrypt from "bcrypt";
var config12 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z7.object({
        email: z7.string().email(),
        password: z7.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler12 = async (req, ctx) => {
  const { email, password } = req.request.body;
  logger12.info("Login attempt", { email });
  const bd = await prisma.bD.findUnique({
    where: { email }
  });
  if (!bd) {
    logger12.warn("Login failed - user not found", { email });
    return {
      status: 401,
      body: { error: "Invalid email or password" }
    };
  }
  if (!bd.isActive) {
    logger12.warn("Login failed - account deactivated", { email });
    return {
      status: 401,
      body: { error: "Account is deactivated" }
    };
  }
  const passwordValid = await bcrypt.compare(password, bd.password);
  if (!passwordValid) {
    logger12.warn("Login failed - wrong password", { email });
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
  logger12.info("Login successful", { email, role: bd.role });
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
motia.addStep(config, "./steps/api/deals/update.step.ts", handler, "./steps/api/deals/update.step.ts");
motia.addStep(config2, "./steps/api/deals/list.step.ts", handler2, "./steps/api/deals/list.step.ts");
motia.addStep(config3, "./steps/api/deals/create.step.ts", handler3, "./steps/api/deals/create.step.ts");
motia.addStep(config4, "./steps/api/contacts/update.step.ts", handler4, "./steps/api/contacts/update.step.ts");
motia.addStep(config5, "./steps/api/contacts/list.step.ts", handler5, "./steps/api/contacts/list.step.ts");
motia.addStep(config6, "./steps/api/contacts/create.step.ts", handler6, "./steps/api/contacts/create.step.ts");
motia.addStep(config7, "./steps/api/clients/update.step.ts", handler7, "./steps/api/clients/update.step.ts");
motia.addStep(config8, "./steps/api/clients/list.step.ts", handler8, "./steps/api/clients/list.step.ts");
motia.addStep(config9, "./steps/api/clients/detail.step.ts", handler9, "./steps/api/clients/detail.step.ts");
motia.addStep(config10, "./steps/api/clients/create.step.ts", handler10, "./steps/api/clients/create.step.ts");
motia.addStep(config11, "./steps/api/auth/me.step.ts", handler11, "./steps/api/auth/me.step.ts");
motia.addStep(config12, "./steps/api/auth/login.step.ts", handler12, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

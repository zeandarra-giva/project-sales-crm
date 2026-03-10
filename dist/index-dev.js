// index-dev.js
import { Motia, initIII } from "motia";

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

// steps/api/deals/list.step.ts
var config = {
  name: "ListDeals",
  description: "Get list of deals for the current user (or all if manager)",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/deals"
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    const whereClause = user.role === "SALES_MANAGER" ? {} : { bdId: user.id };
    const deals = await prisma.deal.findMany({
      where: whereClause,
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
      },
      orderBy: {
        startDate: "desc"
      }
    });
    const formattedDeals = deals.map((deal) => {
      const today = /* @__PURE__ */ new Date();
      const lastUpdate = deal.lastStageUpdateAt || deal.startDate || today;
      const daysInStage = Math.floor((today.getTime() - lastUpdate.getTime()) / (1e3 * 3600 * 24));
      return {
        ...deal,
        stage_name: deal.stage.name,
        days_in_stage: daysInStage
      };
    });
    return {
      status: 200,
      body: formattedDeals
    };
  } catch (error) {
    logger.warn("Failed to list deals", { error: error.message });
    return {
      status: error.message === "Not authenticated" ? 401 : 500,
      body: { error: error.message }
    };
  }
};

// steps/api/deals/create.step.ts
import { z } from "zod";
var config2 = {
  name: "CreateDeal",
  description: "Create a new deal",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/deals",
      bodySchema: z.object({
        dealName: z.string().min(1),
        clientId: z.string().min(1),
        monthlySubscription: z.number().min(0),
        duration: z.number().min(1),
        leadSource: z.enum(["INBOUND", "OUTBOUND", "REFERRAL"]),
        serviceId: z.string().optional(),
        bundleId: z.string().optional(),
        proposalLink: z.string().optional()
      })
    }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler2 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    const { dealName, clientId, monthlySubscription, duration, leadSource, serviceId, bundleId, proposalLink } = req.body;
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
        lastStageUpdateAt: /* @__PURE__ */ new Date()
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
    logger.info("Created new deal", { dealId: newDeal.id, bdId: user.id });
    return {
      status: 201,
      body: {
        ...newDeal,
        stage_name: newDeal.stage.name,
        days_in_stage: 0
      }
    };
  } catch (error) {
    logger.warn("Failed to create deal", { error: error.message });
    return {
      status: error.message === "Not authenticated" ? 401 : 500,
      body: { error: error.message }
    };
  }
};

// steps/api/clients/update.step.ts
import { z as z2 } from "zod";
import { Prisma } from "@prisma/client";
var config3 = {
  name: "UpdateClient",
  description: "Update an existing client",
  triggers: [{
    type: "http",
    method: "PATCH",
    path: "/api/clients/:id",
    bodySchema: z2.object({
      name: z2.string().min(1).optional(),
      // all optional for partial update
      brand: z2.string().optional(),
      accountType: z2.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]).optional(),
      status: z2.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
      industryId: z2.string().optional(),
      contactId: z2.string().optional()
      // set primary contact
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler3 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    const { id } = req.pathParams;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return { status: 404, body: { error: "Client not found" } };
    }
    const { industryId, contactId, ...body } = req.body;
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
    logger.info("Client updated", { clientId: id, by: user.id });
    return { status: 200, body: updated };
  } catch (error) {
    logger.error("Failed to update client", { error: error.message, clientId: req.pathParams?.id });
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
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
var config4 = {
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
var handler4 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    logger.info("Listing clients", { userId: user.id });
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
    logger.error("Failed to list clients", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/clients/detail.step.ts
var config5 = {
  name: "GetClientDetail",
  description: "Get a single client by ID",
  triggers: [
    { type: "http", method: "GET", path: "/api/clients/:id" }
  ],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler5 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    const { id } = req.pathParams;
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
    logger.error("Failed to get client details", { error: error.message, clientId: req.pathParams.id });
    return {
      status: error.name === "AuthError" ? 401 : 500,
      body: { error: error.message || "Internal Server Error" }
    };
  }
};

// steps/api/clients/create.step.ts
import { z as z3 } from "zod";
import { Prisma as Prisma2 } from "@prisma/client";
var config6 = {
  name: "CreateClient",
  description: "Create a new client",
  triggers: [{
    type: "http",
    method: "POST",
    path: "/api/clients",
    bodySchema: z3.object({
      // Zod validates BEFORE handler runs
      name: z3.string().min(1),
      // required
      brand: z3.string().optional(),
      accountType: z3.enum(["ENTERPRISE", "CORPORATE", "SMB", "GOVERNMENT"]),
      status: z3.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
      industryId: z3.string().optional(),
      referralId: z3.string().optional()
    })
  }],
  enqueues: [],
  flows: ["sales-pipeline"]
};
var handler6 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    const { name, brand, accountType, status, industryId, referralId } = req.body;
    const client = await prisma.client.create({
      data: { name, brand, accountType, status, industryId, referralId },
      include: { industry: true, contacts: true }
    });
    logger.info("Client created", { clientId: client.id, by: user.id });
    return { status: 201, body: client };
  } catch (error) {
    if (error.name === "AuthError") {
      return { status: 401, body: { error: error.message } };
    }
    if (
      // ← Refactor 4
      error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2025"
    ) {
      return { status: 400, body: { error: "Related record not found (check industryId, referralId)" } };
    }
    logger.error("Failed to create client", { error });
    return { status: 500, body: { error: "Internal server error" } };
  }
};

// steps/api/auth/me.step.ts
var config7 = {
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
var handler7 = async (req, { logger }) => {
  try {
    const user = await authenticate(req);
    logger.info("Auth check successful", { userId: user.id });
    return {
      status: 200,
      body: { user }
    };
  } catch (error) {
    logger.warn("Auth check failed", { error: error.message });
    return {
      status: 401,
      body: { error: "Not authenticated" }
    };
  }
};

// steps/api/auth/login.step.ts
import { z as z4 } from "zod";
import bcrypt from "bcrypt";
var config8 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z4.object({
        email: z4.string().email(),
        password: z4.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler8 = async (req, { logger }) => {
  const { email, password } = req.body;
  logger.info("Login attempt", { email });
  const bd = await prisma.bD.findUnique({
    where: { email }
  });
  if (!bd) {
    logger.warn("Login failed - user not found", { email });
    return {
      status: 401,
      body: { error: "Invalid email or password" }
    };
  }
  if (!bd.isActive) {
    logger.warn("Login failed - account deactivated", { email });
    return {
      status: 401,
      body: { error: "Account is deactivated" }
    };
  }
  const passwordValid = await bcrypt.compare(password, bd.password);
  if (!passwordValid) {
    logger.warn("Login failed - wrong password", { email });
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
  logger.info("Login successful", { email, role: bd.role });
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
motia.addStep(config, "./steps/api/deals/list.step.ts", handler, "./steps/api/deals/list.step.ts");
motia.addStep(config2, "./steps/api/deals/create.step.ts", handler2, "./steps/api/deals/create.step.ts");
motia.addStep(void 0, "./steps/api/contacts/list.step.ts", void 0, "./steps/api/contacts/list.step.ts");
motia.addStep(config3, "./steps/api/clients/update.step.ts", handler3, "./steps/api/clients/update.step.ts");
motia.addStep(config4, "./steps/api/clients/list.step.ts", handler4, "./steps/api/clients/list.step.ts");
motia.addStep(config5, "./steps/api/clients/detail.step.ts", handler5, "./steps/api/clients/detail.step.ts");
motia.addStep(config6, "./steps/api/clients/create.step.ts", handler6, "./steps/api/clients/create.step.ts");
motia.addStep(config7, "./steps/api/auth/me.step.ts", handler7, "./steps/api/auth/me.step.ts");
motia.addStep(config8, "./steps/api/auth/login.step.ts", handler8, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

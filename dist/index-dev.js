// index-dev.js
import { Motia, initIII } from "motia";

// lib/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

// lib/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "change-me-to-a-32-char-random-string";
var JWT_EXPIRE_MINUTES = parseInt(process.env.JWT_EXPIRE_MINUTES || "1440", 10);
var JWT_EXPIRE_SECONDS = JWT_EXPIRE_MINUTES * 60;
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE_SECONDS
    // number (seconds) — always valid, avoids StringValue brand issue
  });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
async function authenticate(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    throw new Error("No authorization header");
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("No token provided");
  }
  const payload = verifyToken(token);
  const bd = await prisma.bD.findUnique({
    where: { id: payload.bdId }
  });
  if (!bd) {
    throw new Error("User not found");
  }
  if (!bd.isActive) {
    throw new Error("Account is deactivated");
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

// steps/api/auth/me.step.ts
var config3 = {
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
var handler3 = async (req, { logger }) => {
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
import { z as z2 } from "zod";
import bcrypt from "bcrypt";
var config4 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z2.object({
        email: z2.string().email(),
        password: z2.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler4 = async (req, { logger }) => {
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
motia.addStep(config3, "./steps/api/auth/me.step.ts", handler3, "./steps/api/auth/me.step.ts");
motia.addStep(config4, "./steps/api/auth/login.step.ts", handler4, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

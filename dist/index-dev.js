// index-dev.js
import { Motia, initIII } from "motia";

// lib/auth.ts
import jwt from "jsonwebtoken";

// lib/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

// lib/auth.ts
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

// steps/api/auth/me.step.ts
var config = {
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
var handler = async (req, { logger }) => {
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
import { z } from "zod";
import bcrypt from "bcrypt";
var config2 = {
  name: "AuthLogin",
  description: "Authenticate BD member and return JWT",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/auth/login",
      bodySchema: z.object({
        email: z.string().email(),
        password: z.string().min(1)
      })
    }
  ],
  enqueues: [],
  flows: ["auth"]
};
var handler2 = async (req, { logger }) => {
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
motia.addStep(config, "./steps/api/auth/me.step.ts", handler, "./steps/api/auth/me.step.ts");
motia.addStep(config2, "./steps/api/auth/login.step.ts", handler2, "./steps/api/auth/login.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map

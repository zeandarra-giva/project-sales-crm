# Project Sales CRM

A full-stack Sales CRM built for BD (Business Development) teams to manage deals, track pipeline stages, monitor quotas, and generate forecasts. The backend runs on **Motia** (event-driven workflow engine) with **Prisma** + **PostgreSQL**, and the frontend is a **React** + **Vite** + **Tailwind CSS** SPA.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Set Up Environment Variables](#3-set-up-environment-variables)
  - [4. Set Up the Database](#4-set-up-the-database)
  - [5. Start the Application](#5-start-the-application)
- [Default Accounts](#default-accounts)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Backend — Motia Engine](#backend--motia-engine)
  - [API Endpoints](#api-endpoints)
  - [Cron Jobs](#cron-jobs)
  - [Event Handlers](#event-handlers)
- [Frontend — React SPA](#frontend--react-spa)
  - [Pages & Routes](#pages--routes)
  - [State Management](#state-management)
- [Database Schema](#database-schema)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────┐     HTTP :3111     ┌──────────────────────────┐
│                     │ ◄────────────────► │    Motia Engine (iii)    │
│   React Frontend    │                    │                          │
│   (Vite :5173)      │     Proxy /api     │  ┌─ REST API Module     │
│                     │ ──────────────────►│  ├─ Stream Module        │
│   Tailwind + Zustand│                    │  ├─ PubSub Module        │
│   React Query       │                    │  ├─ Cron Module          │
│   Recharts          │                    │  ├─ Worker Module        │
└─────────────────────┘                    │  └─ Telemetry Module     │
                                           │                          │
                                           │  Steps (API / Cron / Events)
                                           └────────┬─────────────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │   PostgreSQL DB   │
                                           │   (via Prisma)    │
                                           └──────────────────┘
```

---

## Prerequisites

Before you begin, make sure you have the following installed on your machine:

| Tool         | Version   | Notes                                                   |
| ------------ | --------- | ------------------------------------------------------- |
| **Node.js**  | >= 18.x   | Required for both backend and frontend                  |
| **npm**      | >= 9.x    | Comes with Node.js                                      |
| **iii-cli**  | latest    | The Motia runtime CLI — install via `npm i -g iii-cli`  |
| **PostgreSQL** | >= 14.x | The database. Can be local, Docker, or a hosted service |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd project-sales-crm
```

### 2. Install Dependencies

There are two separate `package.json` files — one for the backend (root) and one for the frontend.

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
npm install --prefix frontend
```

**Backend dependencies include:** `motia`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `zod`, `dotenv`, `iii-sdk`

**Frontend dependencies include:** `react`, `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `recharts`, `framer-motion`, `tailwindcss`, `lucide-react`, `date-fns`, `react-hook-form`, `clsx`

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# .env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sales_crm?schema=public"

# JWT Configuration
JWT_SECRET="your-secret-key-at-least-32-characters-long"
JWT_EXPIRE_MINUTES=1440    # Optional — defaults to 1440 (24 hours)
```

Replace `USER` and `PASSWORD` with your PostgreSQL credentials. Create the database first if it doesn't exist:

```bash
createdb sales_crm
```

### 4. Set Up the Database

Generate the Prisma client, run migrations, and seed the database with initial data:

```bash
# Generate Prisma client from schema
npx prisma generate

# Run all migrations against your database
npx prisma migrate dev

# Seed the database with pipeline stages, industries, services, BD members, sample clients, deals, and targets
npx prisma db seed
```

The seed script creates:

- **7 Pipeline Stages**: Inquiry → Prospecting → Discovery → Proposal Sent → Negotiation → Closed Won / Closed Lost
- **13 Industries**: Technology & IT, Financial Services, Healthcare, Retail, Manufacturing, etc.
- **4 Services**: LOCOBUZZ, MEDIAWATCH, SHAREDVIEW, REPORTS
- **4 BD Members**: 3 BD Reps + 1 Sales Manager (all with password `changeme123`)
- **8 Sample Clients** with various account types
- **15 Sample Deals** spread across different stages with projections
- **Quarterly & Monthly Targets** for each BD Rep (₱1,750,000/quarter)
- **Date Dimensions** for all 12 months of 2026

### 5. Start the Application

You need **three terminals** running simultaneously:

**Terminal 1 — Motia Backend Engine:**
```bash
npm run dev
```
This starts the iii engine on port `3111` (REST API) and `3112` (Streams). It watches `steps/**/*.step.ts` and `lib/**/*.ts` for hot-reload through the exec module in `config.yaml`.

**Terminal 2 — Frontend Dev Server:**
```bash
npm run dev --prefix frontend
```
This starts the Vite dev server on `http://localhost:5173`. The frontend proxies `/api` requests to `localhost:3000`.

**Terminal 3 — Database Studio (Optional):**
```bash
npm run db:studio
```
Opens Prisma Studio at `http://127.0.0.1:5556`. This avoids collisions with the default Studio port and binds only to localhost.

---

## Default Accounts

After seeding, these accounts are available for login:

| Name    | Email                  | Password      | Role            |
| ------- | ---------------------- | ------------- | --------------- |
| Henne   | henne@company.com      | changeme123   | BD Rep          |
| Isten   | isten@company.com      | changeme123   | BD Rep          |
| Brian   | brian@company.com      | changeme123   | BD Rep          |
| Manager | manager@company.com    | changeme123   | Sales Manager   |

**BD Reps** can only see and manage their own deals. **Sales Managers** have full visibility across all BD members and access to the Executive Dashboard.

---

## Project Structure

```
project-sales-crm/
├── config.yaml              # Motia engine configuration (modules, ports, watchers)
├── motia.config.ts          # Motia project config
├── prisma.config.ts         # Prisma datasource config (reads DATABASE_URL)
├── package.json             # Backend dependencies & scripts
├── tsconfig.json            # TypeScript config for backend
├── types.d.ts               # Auto-generated Motia type declarations
│
├── prisma/
│   ├── schema.prisma        # Database schema (all models, enums, relations)
│   ├── seed.ts              # Seed script (stages, industries, BDs, deals, targets)
│   └── migrations/          # Prisma migration history
│
├── lib/
│   ├── auth.ts              # JWT sign/verify, authenticate middleware
│   ├── db.ts                # Singleton PrismaClient export
│   ├── notifications.ts     # Notification helpers (placeholder)
│   └── validators.ts        # Input validation helpers (placeholder)
│
├── steps/
│   ├── api/                 # REST API step handlers
│   │   ├── auth/            # POST /login, GET /me
│   │   ├── clients/         # CRUD for clients
│   │   ├── contacts/        # CRUD for contacts
│   │   ├── deals/           # CRUD + stage transitions + history
│   │   ├── dashboard/       # BD dashboard + Executive dashboard
│   │   ├── notifications/   # List, mark read, mark all read
│   │   ├── payments/        # Record and list payments
│   │   ├── pipelineStages/  # List pipeline stages
│   │   ├── services/        # List active services
│   │   └── reports/         # (placeholder)
│   ├── cron/
│   │   └── checkStuckDeals.step.ts   # Daily 8 AM — alert on stuck deals
│   └── events/
│       └── onDealStageChanged.step.ts # Notification on stage transitions
│
└── frontend/
    ├── package.json         # Frontend dependencies
    ├── vite.config.ts       # Vite config with /api proxy
    ├── tsconfig.json        # Frontend TypeScript config
    └── src/
        ├── main.tsx         # React entry point with QueryClient + Router
        ├── App.tsx          # Route definitions + layouts
        ├── index.css        # Global styles (Tailwind)
        ├── api/             # Axios client + endpoint wrappers
        ├── components/      # UI components (layout, deals, dashboard, etc.)
        ├── hooks/           # React Query hooks (useDeals, useClients, etc.)
        ├── lib/             # Utilities (currency formatting, stage colors, etc.)
        ├── pages/           # Page components (Dashboard, Pipeline, etc.)
        ├── store/           # Zustand stores (auth, UI)
        ├── types/           # TypeScript interfaces (Deal, Client, Contact, etc.)
        └── mockData.ts      # Fallback mock data for dashboard
```

---

## Tech Stack

### Backend
- **Motia** (`motia` + `iii-cli` + `iii-sdk`) — Event-driven workflow engine that runs API steps, cron jobs, and event handlers
- **Prisma** (`@prisma/client` + `prisma`) — Type-safe ORM for PostgreSQL
- **PostgreSQL** — Relational database
- **bcrypt** — Password hashing
- **jsonwebtoken** — JWT authentication
- **Zod** — Schema validation
- **TypeScript** — Type safety

### Frontend
- **React 18** — UI framework
- **Vite** — Dev server and build tool
- **Tailwind CSS** — Utility-first styling
- **React Router v6** — Client-side routing
- **TanStack React Query** — Server state management and caching
- **Zustand** — Client state management (auth, UI)
- **Axios** — HTTP client with interceptors
- **Recharts** — Charts and data visualization
- **Framer Motion** — Animations
- **Lucide React** — Icon set
- **date-fns** — Date formatting
- **react-hook-form** — Form handling

---

## Backend — Motia Engine

The backend uses Motia's step-based architecture. Each endpoint, cron job, or event handler is a `.step.ts` file that Motia discovers and registers automatically.

### API Endpoints

#### Authentication
| Method | Path                | Description                          |
| ------ | ------------------- | ------------------------------------ |
| POST   | `/api/auth/login`   | Login with email + password, returns JWT |
| GET    | `/api/auth/me`      | Get current user profile from token  |

#### Deals
| Method | Path                      | Description                                      |
| ------ | ------------------------- | ------------------------------------------------ |
| GET    | `/api/deals`              | List deals (scoped by role — BD sees own only)   |
| POST   | `/api/deals`              | Create new deal (auto-assigns to current BD)     |
| GET    | `/api/deals/:id`          | Get deal details with relations                  |
| PATCH  | `/api/deals/:id`          | Update deal fields (recalculates revenue)        |
| PATCH  | `/api/deals/:id/stage`    | Move deal to new stage (creates audit log, fires event) |
| GET    | `/api/deals/:id/history`  | Get full stage transition history                |

#### Clients
| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/clients`      | List all clients with contacts and deals |
| POST   | `/api/clients`      | Create new client                        |
| GET    | `/api/clients/:id`  | Get client with full relations           |
| PATCH  | `/api/clients/:id`  | Update client                            |

#### Contacts
| Method | Path                 | Description                      |
| ------ | -------------------- | -------------------------------- |
| GET    | `/api/contacts`      | List all contacts                |
| POST   | `/api/contacts`      | Create contact for a client      |
| PATCH  | `/api/contacts/:id`  | Update contact details           |

#### Dashboard
| Method | Path                        | Description                                         |
| ------ | --------------------------- | --------------------------------------------------- |
| GET    | `/api/dashboard/bd`         | BD-level metrics (quota, pipeline, forecast, deals)  |
| GET    | `/api/dashboard/executive`  | Team-wide metrics (managers only)                    |

#### Notifications
| Method | Path                          | Description                     |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/notifications`              | List notifications (last 50)    |
| PATCH  | `/notifications/:id/read`     | Mark single notification as read |
| POST   | `/notifications/read-all`     | Mark all as read                |

#### Other
| Method | Path                     | Description              |
| ------ | ------------------------ | ------------------------ |
| GET    | `/api/pipeline-stages`   | List all pipeline stages |
| GET    | `/api/services`          | List all active services |
| POST   | `/api/payments`          | Record a payment         |
| GET    | `/api/payments`          | List payments            |

### Cron Jobs

**Check Stuck Deals** — Runs daily at 8:00 AM. Finds deals that have been in their current stage longer than the stage's target duration (default 3 days) and creates a `DEAL_STUCK` notification for the responsible BD rep.

### Event Handlers

**On Deal Stage Changed** — Triggered when a deal moves to a new stage via the stage transition endpoint. Creates a `STAGE_CHANGE` notification for the deal owner. If a manager moved the deal, the manager also gets notified.

---

## Frontend — React SPA

### Pages & Routes

All routes below require authentication (enforced by `AuthGuard`):

| Route              | Page                | Description                                                |
| ------------------ | ------------------- | ---------------------------------------------------------- |
| `/login`           | Login               | Email/password login form                                  |
| `/dashboard`       | BD Dashboard        | Personal quota gauge, pipeline metrics, open/stuck deals   |
| `/executive`       | Executive Dashboard | Team performance, leaderboard, pipeline breakdown (managers only) |
| `/pipeline`        | Pipeline Board      | Kanban board with drag-and-drop stage transitions          |
| `/deals/new`       | New Deal            | Create a new deal form                                     |
| `/deals/:id`       | Deal Detail         | Full deal view with stage history, remarks, audit log      |
| `/clients`         | Client List         | All clients with account type filtering                    |
| `/clients/new`     | New Client          | Create a new client form                                   |
| `/clients/:id`     | Client Detail       | Client overview with revenue, deals, and contacts          |
| `/contacts`        | Contact List        | All contacts with decision rank filtering                  |
| `/contacts/new`    | New Contact         | Create a new contact form                                  |
| `/notifications`   | Notifications       | Notification center with mark-as-read                      |
| `/reports`         | Reports             | Multi-tab analytics (Pipeline, Win/Loss, Sales Cycle, etc.) |
| `/payments`        | Payments            | Payment tracking                                           |

### State Management

- **Zustand (`useAuthStore`)** — Manages JWT token, current user, login/logout. Persisted to `localStorage`.
- **Zustand (`useUIStore`)** — Sidebar state, active modal tracking.
- **React Query** — All server data (deals, clients, contacts, dashboard, notifications) is fetched and cached via React Query hooks with automatic invalidation on mutations.

---

## Database Schema

The database uses PostgreSQL with the following core models (see `prisma/schema.prisma` for full details):

| Model              | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `BD`               | Sales representatives and managers                       |
| `Client`           | Company accounts (Enterprise, Corporate, SMB, Government)|
| `Contact`          | Client stakeholders with decision rank tiers (1–5)       |
| `Deal`             | Central fact table — pipeline deals with revenue, stage, dates |
| `DealAuditLog`     | Immutable log of every stage transition                  |
| `DealProjection`   | Per-deal probability and weighted forecast value         |
| `DealContact`      | Junction table for multi-stakeholder deals               |
| `DealSnapshot`     | Point-in-time deal state for trend analysis              |
| `PipelineStage`    | Stage metadata with target duration thresholds           |
| `Industry`         | 13 predefined industry categories (self-referencing)     |
| `Service`          | Products offered (LOCOBUZZ, MEDIAWATCH, etc.)            |
| `Bundle`           | Multi-service packages                                   |
| `BundleService`    | Junction table: services within a bundle                 |
| `Target`           | BD member quotas (monthly and quarterly)                 |
| `ForecastSnapshot` | Team/BD-level pipeline snapshot for trend tracking       |
| `Notification`     | In-app alerts (stage change, stuck deal, quota, etc.)    |
| `Payment`          | Monthly payment records against deals                    |
| `DateDimension`    | Time dimension table for analytical queries              |

---

## Common Commands

```bash
# ── Backend ──────────────────────────────────────────
iii-cli start --config config.yaml   # Start the Motia engine
npm run engine                       # Same as above (shortcut)

# ── Frontend ─────────────────────────────────────────
npm run dev --prefix frontend        # Start Vite dev server
npm run frontend                     # Same as above (shortcut)
npm run build --prefix frontend      # Production build

# ── Database ─────────────────────────────────────────
npx prisma studio                    # Visual database browser
npx prisma generate                  # Regenerate Prisma client
npx prisma migrate dev               # Run pending migrations
npx prisma migrate dev --name <name> # Create a new migration
npx prisma db seed                   # Re-run the seed script
npx prisma db push                   # Push schema without migration (dev only)

# ── Motia Console ────────────────────────────────────
npx iii-console                      # Open the Motia console (or: npm run console)
```

---

## Troubleshooting

**"Cannot find module '@prisma/client'"**
Run `npx prisma generate` to generate the Prisma client from your schema.

**Database connection errors**
Make sure your `DATABASE_URL` in `.env` is correct and PostgreSQL is running. Test with: `psql $DATABASE_URL -c "SELECT 1"`

**Port already in use (3111 or 5173)**
Kill the process using the port: `lsof -ti:3111 | xargs kill -9` or change the port in `config.yaml` / `vite.config.ts`.

**Frontend can't reach the backend**
The frontend's Axios client connects directly to `http://localhost:3111` (configured in `frontend/src/api/client.ts`). Make sure the Motia engine is running on port `3111` as defined in `config.yaml`. Vite also has a `/api` proxy configured in `vite.config.ts` but the primary connection is direct.

**Seed script fails**
Make sure migrations have been run first (`npx prisma migrate dev`). The seed script uses `upsert` so it's safe to re-run.

**JWT errors or 401s**
Set a proper `JWT_SECRET` in your `.env`. In development, a fallback secret is used, but it will throw an error in production if `JWT_SECRET` is not set.

**"`npm run dev` exits immediately"**
`motia dev` in newer Motia releases only builds `dist/index-dev.js`; it does not start the iii engine. Use `npm run dev`, which runs `iii-cli start --config config.yaml`, and use `npm run build:dev` if you only want the Motia build artifact.

**"`npx prisma studio` fails to start"**
The plain command uses Prisma Studio defaults, which bind to `0.0.0.0:5555`. If that port is already taken or your machine rejects binding on all interfaces, use `npm run db:studio` instead. That runs Studio on `127.0.0.1:5556` without auto-opening a browser.

**"iii-cli: command not found"**
Install the Motia CLI globally: `npm install -g iii-cli`

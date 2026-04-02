# Sales CRM Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                       │
│  Vite :5173  │  Zustand  │  React Query  │  TailwindCSS    │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api proxy
┌──────────────────────────▼──────────────────────────────────┐
│                   Motia Engine (:3111)                       │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐  │
│  │ REST API │  │  PubSub  │  │  Cron  │  │    Queue     │  │
│  │ Module   │  │  Module  │  │ Module │  │    Module     │  │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  └──────┬───────┘  │
│       │              │            │               │          │
│  ┌────▼──────────────▼────────────▼───────────────▼───────┐  │
│  │              Step Handlers (steps/)                     │  │
│  │   api/*.step.ts  │  cron/*.step.ts  │  events/*.step.ts│  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              PostgreSQL + Prisma ORM                         │
│              18 models │ 8 enums │ migrations                │
└──────────────────────────────────────────────────────────────┘
```

## Backend Architecture

### Motia Framework

The backend uses [Motia](https://motia.dev), an event-driven workflow engine. Motia provides:

| Module         | Port | Purpose                              |
|----------------|------|--------------------------------------|
| RestApiModule  | 3111 | HTTP REST API                        |
| StreamModule   | 3112 | Event streaming with KvStore adapter |
| PubSubModule   | —    | Publish-subscribe event distribution |
| CronModule     | —    | Scheduled jobs                       |
| QueueModule    | —    | Async message queue                  |
| WorkerModule   | —    | Background job processing            |
| StateModule    | —    | Persistent state storage             |
| TelemetryModule| —    | Logging and monitoring               |

Configuration lives in `config.yaml` at project root.

### Step-Based Architecture

Every backend handler is a **step** — an independently deployable unit with a config and handler:

```typescript
// steps/api/deals/create.step.ts
export const config = {
  name: 'CreateDeal',
  description: 'Create a new deal',
  triggers: [
    { type: 'http', method: 'POST', path: '/api/deals', bodySchema: z.object({ ... }) }
  ],
  enqueues: ['deal.created'],
  flows: ['sales-pipeline'],
}

export const handler: Handlers<typeof config> = async (req, ctx) => {
  const user = await authenticate(req.request)
  // ... business logic
  await ctx.enqueue('deal.created', { dealId, bdId })
  return { status: 201, body: deal }
}
```

**Step types:**
- `api/*.step.ts` — HTTP request handlers (triggered by REST calls)
- `cron/*.step.ts` — Scheduled tasks (triggered by cron expressions)
- `events/*.step.ts` — Event handlers (triggered by queue topics)

### Shared Libraries (`lib/`)

| File              | Purpose                                              |
|-------------------|------------------------------------------------------|
| `auth.ts`         | JWT signing/verification, `authenticate()` middleware, `AuthError` class |
| `db.ts`           | Prisma client singleton                              |
| `validators.ts`   | Reusable Zod validation helpers                      |
| `notifications.ts`| Notification creation helpers                        |

---

## Database Schema

### Entity Relationship Overview

```
BD (Sales Rep)
 ├── 1:N → Deal
 ├── 1:N → Target (quotas)
 ├── 1:N → Notification
 ├── 1:N → GrowthEntry
 ├── 1:N → DealAuditLog (as changedBy)
 ├── 1:N → DealProjection
 └── 1:N → ForecastSnapshot

Deal
 ├── N:1 → BD (owner)
 ├── N:1 → Client
 ├── N:1 → PipelineStage
 ├── N:1 → Service (optional)
 ├── N:1 → Bundle (optional)
 ├── 1:N → DealAuditLog
 ├── 1:N → DealContact → Contact
 ├── 1:N → DealSnapshot
 ├── 1:N → Payment
 ├── 1:N → Notification
 └── 1:1 → DealProjection

Client
 ├── N:1 → Industry
 ├── 1:N → Contact
 ├── 1:N → Deal
 └── self-ref → Client (referral)

Service ←→ Bundle (via BundleService junction)
DateDimension ← referenced by Target, Payment, DealProjection, DealSnapshot, ForecastSnapshot
```

### Models

| Model             | Purpose                                          | Key Fields                                        |
|-------------------|--------------------------------------------------|---------------------------------------------------|
| BD                | Sales reps & managers                            | firstName, lastName, email, role, isActive         |
| Client            | Company accounts                                 | name, brand, accountType, status, industryId       |
| Contact           | Client stakeholders                              | firstName, lastName, email, designation, decisionRank |
| Deal              | Central pipeline entity                          | dealName, monthlySubscription, revenue, duration, stageId |
| DealAuditLog      | Stage transition history                         | stageId, enteredAt, exitedAt, daysInStage, remarks |
| DealProjection    | Per-deal forecast                                | projectedAmount, dateId                           |
| DealContact       | Deal-to-Contact junction                         | roleInDeal, isPrimary, lastContacted              |
| DealSnapshot      | Point-in-time deal state                         | probabilityPct, projectedAmount, weightedValue    |
| PipelineStage     | Stage definitions                                | name, duration (target days)                      |
| Industry          | Industry categories (self-referencing)           | name, parentIndustryId                            |
| Service           | Products (LOCOBUZZ, MEDIAWATCH, etc.)            | name, description, isActive                       |
| Bundle            | Multi-service packages                           | name                                              |
| BundleService     | Service-Bundle junction                          | serviceValue, revenueSharePct                     |
| Target            | BD quotas                                        | quota, periodType, dateId, bdId                   |
| ForecastSnapshot  | Team-level pipeline snapshot                     | totalPipelineValue, totalWeightedValue, dealCount |
| Notification      | In-app alerts                                    | content, type, isRead, triggeredBy                |
| Payment           | Monthly payment tracking                         | amount, dateId, dealId                            |
| DateDimension     | Time dimension table                             | year, month, quarter, dayOfWeek, isQuarterEnd     |
| GrowthEntry       | Growth tracking per BD                           | label, year, quarter, revenue, notes              |

### Enums

| Enum              | Values                                                                        |
|-------------------|-------------------------------------------------------------------------------|
| Role              | BD_REP, SALES_MANAGER                                                        |
| LeadSource        | INBOUND, OUTBOUND, REFERRAL                                                  |
| AccountType       | ENTERPRISE, CORPORATE, SMB, GOVERNMENT                                       |
| ClientStatus      | ACTIVE, INACTIVE, PROSPECT                                                   |
| DecisionRank      | TIER_1_ECONOMIC_BUYER, TIER_2_DECISION_MAKER, TIER_3_INFLUENCER, TIER_4_END_USER, TIER_5_GATEKEEPER |
| PeriodType        | MONTHLY, QUARTERLY, ANNUAL                                                   |
| NotificationType  | STAGE_CHANGE, DEAL_STUCK, ACTION_PLAN_DUE, FOLLOW_UP_DUE, QUOTA_BEHIND_PACE, NEW_DEAL_ASSIGNED, LOST_DEAL_FOLLOW_UP |
| NotificationTrigger | STAGE_CHANGE, ACTION_PLAN_PASSED, DAYS_IN_STAGE_EXCEEDED, NO_FOLLOW_UP_IN_14_DAYS, QUOTA_BEHIND_PACE, CLOSED_LOST_AGE |

### Pipeline Stages (seeded)

1. Inquiry
2. Qualification
3. Proposal
4. Negotiation
5. Contract Review
6. Closed Won (no duration limit)
7. Closed Lost (no duration limit)

---

## API Endpoints

### Authentication

| Method | Path              | Auth | Description                    |
|--------|-------------------|------|--------------------------------|
| POST   | /api/auth/login   | No   | Email + password → JWT + user  |
| GET    | /api/auth/me      | Yes  | Current user profile           |

### Deals

| Method | Path                    | Auth | Description                              |
|--------|-------------------------|------|------------------------------------------|
| GET    | /api/deals              | Yes  | List deals (BD: own, Manager: all)       |
| POST   | /api/deals              | Yes  | Create deal → emits `deal.created`       |
| GET    | /api/deals/:id          | Yes  | Deal detail with relations               |
| PATCH  | /api/deals/:id          | Yes  | Update deal fields                       |
| PATCH  | /api/deals/:id/stage    | Yes  | Move stage → emits `deal.stage.changed`  |
| GET    | /api/deals/:id/history  | Yes  | Stage transition audit log               |

### Clients

| Method | Path              | Auth | Description                |
|--------|-------------------|------|----------------------------|
| GET    | /api/clients      | Yes  | List with contacts & deals |
| POST   | /api/clients      | Yes  | Create client              |
| GET    | /api/clients/:id  | Yes  | Client detail              |
| PATCH  | /api/clients/:id  | Yes  | Update client              |

### Contacts

| Method | Path                | Auth | Description    |
|--------|---------------------|------|----------------|
| GET    | /api/contacts       | Yes  | List contacts  |
| POST   | /api/contacts       | Yes  | Create contact |
| PATCH  | /api/contacts/:id   | Yes  | Update contact |

### Dashboards

| Method | Path                     | Auth | Role    | Description                     |
|--------|--------------------------|------|---------|---------------------------------|
| GET    | /api/dashboard/bd        | Yes  | Any     | Personal metrics + pipeline     |
| GET    | /api/dashboard/executive | Yes  | Manager | Team metrics + leaderboard      |

Query params: `?quarter=2&year=2026&bdId=<id>` (bdId for manager viewing specific rep)

### Notifications

| Method | Path                         | Auth | Description         |
|--------|------------------------------|------|---------------------|
| GET    | /notifications               | Yes  | List (last 50)      |
| PATCH  | /notifications/:id/markRead  | Yes  | Mark single as read |
| PATCH  | /notifications/markAllRead   | Yes  | Mark all as read    |

### Services, Payments, Reporting

| Method | Path                  | Auth | Description          |
|--------|-----------------------|------|----------------------|
| GET    | /api/services         | Yes  | List active services |
| GET    | /api/pipeline-stages  | Yes  | List all stages      |
| POST   | /api/payments         | Yes  | Record payment       |
| GET    | /api/payments         | Yes  | List payments        |
| GET    | /api/reporting/periods| Yes  | Reporting periods    |

### Growth Entries

| Method | Path                       | Auth | Description         |
|--------|----------------------------|------|---------------------|
| POST   | /api/growthEntries/create  | Yes  | Create entry        |
| GET    | /api/growthEntries/list    | Yes  | List entries        |
| PATCH  | /api/growthEntries/:id     | Yes  | Update entry        |

---

## Frontend Architecture

### Tech Stack

- **React 18** with TypeScript
- **Vite** — dev server (:5173) + bundler, proxies `/api` → `:3111`
- **TailwindCSS** — utility-first styling with custom design tokens
- **Zustand** — client state (auth persisted to localStorage, UI state)
- **TanStack React Query** — server state with caching and auto-invalidation
- **Axios** — HTTP client with JWT interceptors
- **React Router v6** — nested routing with layout components
- **Recharts** — charts and data visualization
- **Framer Motion** — animations
- **react-hook-form** — form state and validation

### Routing

All routes are protected by `<AuthGuard>` (checks JWT token).

| Route            | Component          | Access  | Description                  |
|------------------|--------------------|---------|------------------------------|
| /login           | LoginPage          | Public  | Authentication               |
| /dashboard       | BDDashboard        | All     | Personal quota & pipeline    |
| /executive       | ExecutiveDashboard | Manager | Team metrics & leaderboard   |
| /pipeline        | Pipeline           | All     | Kanban + list view           |
| /deals/new       | NewDeal            | All     | Create deal form             |
| /deals/:id       | DealDetail         | All     | Deal with history & stages   |
| /clients         | ClientList         | All     | Client listing               |
| /clients/new     | NewClient          | All     | Create client form           |
| /clients/:id     | ClientDetail       | All     | Client overview              |
| /contacts        | ContactList        | All     | Contact listing              |
| /contacts/new    | NewContact         | All     | Create contact form          |
| /reports         | Reports            | All     | Analytics (pipeline, win/loss)|
| /payments        | Payments           | All     | Payment tracking             |
| /notifications   | NotificationsPage  | All     | Notification center          |

**Layouts:**
- `ProtectedLayout` — sidebar + header wrapper for all authenticated routes
- `ManagerLayout` — additional role gate for manager-only routes (`/executive`)

### State Management

```
┌─────────────────────────────────────────────┐
│              Frontend State                  │
│                                              │
│  Zustand (Client State)                      │
│  ├── authStore: user, token, isAuthenticated │
│  │   (persisted to localStorage)             │
│  └── uiStore: sidebar, modals                │
│                                              │
│  React Query (Server State)                  │
│  ├── ['deals'] → useDeals()                  │
│  ├── ['deal', id] → useDeal(id)              │
│  ├── ['clients'] → useClients()              │
│  ├── ['contacts'] → useContacts()            │
│  ├── ['dashboard'] → useDashboard()          │
│  ├── ['notifications'] → useNotifications()  │
│  ├── ['pipeline-stages'] → usePipelineStages()│
│  └── ['payments'] → usePayments()            │
└─────────────────────────────────────────────┘
```

### API Layer

```
frontend/src/api/
├── client.ts          # Axios instance with JWT interceptor
├── auth.ts            # login(), getMe()
├── deals.ts           # CRUD + stage + history + data mappers
├── clients.ts         # CRUD with enum conversion
├── contacts.ts        # CRUD
├── dashboard.ts       # BD + executive dashboard
├── notifications.ts   # List + mark read
├── payments.ts        # Create + list
├── services.ts        # Service listing
├── reporting.ts       # Reporting periods
└── reports.ts         # Report data
```

The Axios client automatically:
- Attaches JWT token from authStore on every request
- Catches 401 responses → clears auth → redirects to `/login`

---

## Authentication & Authorization

### Flow

```
1. POST /api/auth/login { email, password }
2. Server validates with bcrypt
3. Server returns JWT { bdId, email, role } (24h expiry)
4. Frontend stores token in Zustand (→ localStorage)
5. Axios interceptor attaches token to all requests
6. Each step handler calls authenticate(req) to verify
7. Role-based logic scopes data access
```

### Role-Based Access Control

| Capability           | BD_REP        | SALES_MANAGER  |
|----------------------|---------------|----------------|
| View own deals       | Yes           | Yes            |
| View all deals       | No            | Yes            |
| Create deals         | Yes (self)    | Yes            |
| Executive dashboard  | No (403)      | Yes            |
| BD dashboard         | Own only      | Any rep's      |
| Manage stages        | Own deals     | Any deal       |

Authorization is enforced at the query level (WHERE clauses), not post-fetch filtering.

---

## Event-Driven Workflows

### Event Topics

| Topic                | Publisher              | Consumer              |
|----------------------|------------------------|-----------------------|
| `deal.created`       | Create Deal step       | onDealCreated handler |
| `deal.stage.changed` | Update Stage step      | onDealStageChanged handler |

### Event Handlers

**onDealCreated** (`steps/events/onDealCreated.step.ts`):
- Creates initial DealProjection
- Sends NEW_DEAL_ASSIGNED notification to BD rep

**onDealStageChanged** (`steps/events/onDealStageChanged.step.ts`):
- Creates STAGE_CHANGE notification for deal owner
- If manager initiated the change, also notifies the manager

### Cron Jobs

**checkStuckDeals** (`steps/cron/checkStuckDeals.step.ts`):
- Schedule: Daily at 8:00 AM (`0 8 * * *`)
- Logic: Finds deals exceeding their stage's duration threshold
- Action: Creates DEAL_STUCK notification (deduplicated per deal per day)

---

## Business Rules

1. **Revenue Calculation**: `revenue = monthlySubscription * duration`
2. **Sales Forecast**: `Closed Won revenue + 80% of Negotiation pipeline`
3. **Stage Transitions**:
   - Always require remarks and action plan
   - Closed Won requires contract link
   - Closed Lost requires meaningful loss reason (captures finalProposedValue)
4. **Stuck Deal Detection**: Deals in same stage longer than `PipelineStage.duration` (default threshold)
5. **Quota Tracking**: Quarterly and monthly targets per BD rep
6. **Audit Trail**: Every stage change creates an immutable DealAuditLog entry with timestamps, who changed it, and why

---

## Key Design Patterns

1. **Audit-Driven Tracking** — Every stage transition creates a DealAuditLog row with exact timestamps, enabling stuck-deal detection and loss analysis
2. **Event-Driven Side Effects** — Deal mutations publish events; async handlers create notifications without blocking API responses
3. **Role-Scoped Queries** — Authorization applied at the database query level via WHERE clauses, not post-fetch filtering
4. **Atomic Transactions** — Multi-step operations (deal creation, stage updates) wrapped in Prisma transactions
5. **Time Dimension Tables** — DateDimension model enables flexible reporting across arbitrary time periods
6. **Singleton Prisma Client** — Single shared instance via `lib/db.ts` prevents connection pool exhaustion
7. **Step Isolation** — Each Motia step is independently deployable with its own config, schema validation, and handler

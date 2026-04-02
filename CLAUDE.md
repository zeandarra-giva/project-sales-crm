# Sales CRM

B2B Sales CRM for managing deals, clients, contacts, and pipeline analytics. Built with Motia (event-driven backend), React, Prisma, and PostgreSQL.

## Tech Stack

- **Backend**: Motia (event-driven framework), TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: React 18, Vite, TailwindCSS, Zustand, TanStack React Query
- **Auth**: JWT + bcrypt
- **Validation**: Zod schemas

## Development Setup

```bash
# Backend
npm install
cp .env.example .env          # Configure DATABASE_URL and JWT_SECRET
npx prisma migrate dev         # Run migrations
npx prisma db seed             # Seed demo data
npm run dev                    # Starts Motia on port 3111

# Frontend
cd frontend
npm install
npm run dev                    # Starts Vite on port 5173 (proxies /api to 3111)
```

## Key Commands

```bash
# Backend
npm run dev                    # Start Motia dev server
npm run console                # Motia interactive console
npm run db:generate            # Regenerate Prisma client
npm run db:migrate             # Run pending migrations
npm run db:seed                # Seed database
npx prisma studio             # Visual database browser

# Frontend
cd frontend
npm run dev                    # Start dev server
npm run build                  # Production build (tsc && vite build)
```

## Environment Variables

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sales_crm?schema=public"
JWT_SECRET="your-secret-key-at-least-32-characters-long"
JWT_EXPIRE_MINUTES=1440        # Optional, defaults to 24 hours
NODE_ENV=production            # Optional, enforces JWT_SECRET validation
```

## Project Structure

```
sales_crm/
├── lib/                       # Backend utilities (auth, db, validators, notifications)
├── prisma/                    # Schema, migrations, seed
├── steps/                     # Motia step handlers (API, cron, events)
│   ├── api/                   # REST endpoints by domain
│   │   ├── auth/              # login, me
│   │   ├── deals/             # CRUD, stage transitions, history
│   │   ├── clients/           # CRUD
│   │   ├── contacts/          # CRUD
│   │   ├── dashboard/         # BD + executive dashboards
│   │   ├── notifications/     # list, mark read
│   │   ├── payments/          # create, list
│   │   ├── services/          # list
│   │   └── reporting/         # periods
│   ├── cron/                  # Scheduled jobs (stuck deal checks)
│   └── events/                # Async event handlers (deal created/stage changed)
├── frontend/
│   └── src/
│       ├── api/               # Axios client + endpoint wrappers
│       ├── components/        # UI components by feature
│       ├── hooks/             # React Query custom hooks
│       ├── pages/             # Route page components
│       ├── store/             # Zustand stores (auth, ui)
│       ├── types/             # TypeScript interfaces
│       └── lib/               # Utility functions
└── config.yaml                # Motia engine configuration
```

## Code Patterns

### Backend Steps

Every API endpoint is a Motia step file in `steps/api/`:

```typescript
export const config = {
  name: 'StepName',
  triggers: [{ type: 'http', method: 'POST', path: '/api/endpoint', bodySchema: z.object({}) }],
  enqueues: ['topic.name'],  // optional: events to publish
  flows: ['flow-name'],
}

export const handler: Handlers<typeof config> = async (req, ctx) => {
  const user = await authenticate(req.request)  // JWT auth
  // Business logic with prisma
  return { status: 200, body: { ... } }
}
```

### Frontend Hooks

React Query hooks in `frontend/src/hooks/` wrap API calls with caching:

```typescript
export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: () => dealsApi.list() })
}
```

### State Management

- **Zustand** for client state (auth, UI) - persisted to localStorage
- **React Query** for server state (deals, clients, etc.) - cached with auto-invalidation

### Database Access

Always use the Prisma singleton from `lib/db.ts`. Use transactions for multi-step operations (deal creation, stage transitions).

## Roles

- **BD_REP**: Sees only their own deals and dashboard
- **SALES_MANAGER**: Full visibility, executive dashboard access

## Demo Accounts (after seed)

| Name    | Email               | Password    | Role          |
|---------|---------------------|-------------|---------------|
| Henne   | henne@company.com   | changeme123 | BD_REP        |
| Isten   | isten@company.com   | changeme123 | BD_REP        |
| Brian   | brian@company.com   | changeme123 | BD_REP        |
| Manager | manager@company.com | changeme123 | SALES_MANAGER |

## Business Rules

- Revenue = monthlySubscription x duration
- Forecast = Closed Won revenue + 80% of Negotiation pipeline
- Stage transitions require remarks + action plan
- Closed Won requires contract link; Closed Lost requires loss reason
- Stuck deals: flagged when in same stage longer than stage duration threshold

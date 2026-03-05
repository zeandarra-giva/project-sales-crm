# Sales CRM — Frontend

A custom CRM frontend for the BD sales team, built with:

- **React 18 + TypeScript** — Component-based UI
- **Vite 5** — Fast dev server and build
- **Tailwind CSS v4** — Utility-first styling via `@tailwindcss/vite`
- **React Router v6** — Client-side routing
- **TanStack React Query v5** — Server state management
- **Zustand** — Auth & UI state
- **Recharts** — Dashboard charts and visualizations
- **React Hook Form** — Form state management
- **Lucide React** — Icon library

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 3. Build for production

```bash
npm run build
npm run preview
```

## Demo Login

Use any of these accounts (password: `demo`):

| Email | Role |
|---|---|
| henne@company.com | Senior BD Rep |
| isten@company.com | BD Rep |
| brian@company.com | BD Rep |
| maria@company.com | Manager |

> Use the dropdown in the top-right header to quickly switch between demo users.

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Individual BD dashboard with quota, pipeline, metrics |
| `/executive` | Manager-only team dashboard with leaderboard |
| `/pipeline` | Kanban-style pipeline board + list view |
| `/deals/:id` | Deal detail with stage management, remarks, history |
| `/deals/new` | Create new deal form |
| `/clients` | Client accounts list |
| `/contacts` | Contact records with decision rank |
| `/reports` | Analytics — pipeline, quota, win/loss, service perf |
| `/payments` | Monthly subscription payment tracking |
| `/notifications` | Alert center (stuck deals, action plans, etc.) |

## Architecture

All data is currently mocked in `src/mockData.ts`. In production, replace with:

- **Backend:** Motia (API Steps → replace `mockData` with `useQuery` from `src/api/`)
- **Auth:** Replace `authStore` mock login with real JWT endpoint
- **Real-time:** Connect Motia Streams to the notification system

## Design System

Uses custom CSS variables defined in `src/index.css` under `@theme`:
- Dark background palette (`--color-bg`, `--color-surface`)
- Accent blue (`--color-accent: #4f6ef7`)
- Stage-specific colors via CSS classes (`.stage-inquiry`, `.stage-negotiation`, etc.)
- Fonts: **Syne** (display) + **DM Sans** (body)

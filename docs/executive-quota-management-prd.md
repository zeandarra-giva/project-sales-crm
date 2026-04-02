# Executive View and Quarterly Quota Management

## Purpose

Simplify the manager workflow by removing the manager-facing BD dashboard dependency and making the Executive View the manager's primary performance workspace.

This update also adds manager-controlled quarterly quota editing so team target values can be maintained directly from the Executive View.

## Product Decisions

- Managers no longer use the BD `Dashboard` page as their landing workspace.
- Managers land on `Executive View`.
- The `Dashboard` navigation item is visible only to BD reps.
- Quarterly quota targets are editable only by managers.
- Quota editing is available only when a specific quarter is selected.
- The `All` quarter view remains read-only because it is an aggregate.

## User Experience

### BD Rep

- keeps access to `/dashboard`
- does not see or edit team quota targets

### Sales Manager

- is redirected to `/executive` instead of `/dashboard`
- no longer sees `Dashboard` in the sidebar
- uses `Executive View` to monitor team performance
- can edit quarterly quotas per BD rep directly in the Executive View

## Executive View Behavior

The Executive View now has two roles:

1. analytics review
   - team actual
   - team quota
   - team forecast
   - attainment
   - leaderboard
   - pipeline by stage
   - stuck deals

2. quota administration
   - load current quarter targets for all active BD reps
   - edit quota per BD rep
   - save changes in bulk

When quota values are saved:

- CRM target records are updated in `target`
- executive metrics refresh using the updated target values
- analytics-service executive/quota reads reflect the changes automatically because they read the same `target` table

## Data Model

No schema migration was required.

Existing table reused:

- `target`
  - `quota`
  - `period_type = QUARTERLY`
  - `date_id`
  - `bd_id`

Quarterly targets are resolved against the quarter's first month row in `date_dimension`.

## API Changes

### Transactional Service

Added manager-only endpoints:

- `GET /api/targets/quarterly?year=YYYY&quarter=Q`
  - returns editable quarterly targets for all active BD reps

- `PUT /api/targets/quarterly`
  - bulk creates or updates quarterly targets for active BD reps

Request shape:

```json
{
  "year": 2026,
  "quarter": 2,
  "targets": [
    { "bdId": "uuid-1", "quota": 7000000 },
    { "bdId": "uuid-2", "quota": 6500000 }
  ]
}
```

### Analytics Service

No new endpoint was required for quota editing.

Reason:

- Executive and quota analytics already read from the shared `target` table.
- Once the CRM updates quarterly targets, analytics-service dashboard/report responses reflect the new values automatically.

## Frontend Changes

### Routing and Navigation

- managers are redirected to `Executive View`
- managers are prevented from using the BD dashboard route as their working dashboard
- the sidebar hides `Dashboard` for managers

### Executive View

- added `Quarterly Quota Editor`
- editor loads per-BD quarterly target values
- manager can bulk save edited quota values
- editor is disabled on `All` quarter selection

## Acceptance Criteria

- manager does not see `Dashboard` in the sidebar
- manager lands on `/executive`
- BD reps still land on `/dashboard`
- manager can view existing quarterly quotas for all active BD reps
- manager can edit and save quarterly quotas
- updated quarterly quotas immediately affect executive metrics
- `All` quarter view is read-only for quota editing

## Constraints

- quota editing depends on the selected quarter existing in `date_dimension`
- only active `BD_REP` users are included in quarterly target editing
- manager accounts are excluded from editable quota rows

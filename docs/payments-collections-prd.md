# Payments Collections Workflow

## Purpose

Extend the existing Payments feature from a simple payment log into a collections visibility workspace for the sales team without turning it into a full finance billing system.

The feature now supports:

- visibility into booked versus collected revenue
- monthly subscription collection tracking
- account follow-up for unpaid or overdue clients
- reporting that compares closed deals against actual receipts
- manager-wide visibility of all BD payment logs with CRUD controls and filters

## Product Positioning

This is still a sales collections feature, not a finance billing module.

Included:

- payment log entry against closed deals
- monthly billing period tagging for each payment
- collections health by deal and by account
- overdue and unpaid follow-up visibility
- analytics for booked, expected, and collected revenue

Not included:

- invoice generation
- tax handling
- AR ledger reconciliation
- reminder automation
- payment gateway processing

## User Roles

### BD Rep

- can record payments against their own closed deals
- can view only their own payment logs and collections tracking
- can use the page to monitor unpaid and overdue subscription accounts

### Sales Manager

- can view all BD payment logs
- can filter payment logs by BD, year, and quarter
- can create, update, and delete payment logs
- can view manager-level collections reporting across the team

## Workflow

1. A deal is marked `Closed Won`.
2. The deal contributes `booked revenue` based on contract value.
3. Each monthly subscription receipt is logged in Payments with a billing year and billing month.
4. The system derives expected monthly collections from:
   - `deal.startDate`
   - `deal.duration`
   - `deal.monthlySubscription`
5. The Payments page compares:
   - booked revenue
   - expected collections
   - actual collected revenue
   - overdue and outstanding amounts
6. Unpaid or overdue accounts surface in the follow-up queue for BD and manager review.

## Operational Definitions

### Booked Revenue

Contracted revenue from closed deals.

### Expected Revenue

Scheduled monthly subscription amount expected for the selected period based on deal start month and duration.

### Collected Revenue

Actual payments recorded in the payment log for the selected billing periods.

### Outstanding Revenue

Expected revenue minus collected revenue for the selected scope.

### Overdue Revenue

Unpaid scheduled subscription revenue from billing months before the current month.

## Payments Page UX

The Payments page now contains four functional areas:

1. Collections KPI cards
   - booked revenue
   - expected collections
   - collected revenue
   - outstanding revenue
   - overdue revenue

2. Reporting charts
   - monthly booked vs expected vs collected trend
   - collections by BD
   - collections by account type

3. Subscription tracking table
   - deal/account summary
   - monthly subscription amount
   - collected vs outstanding
   - paid, unpaid, and overdue month counts
   - next due month

4. Payment log
   - billing-period-based receipt log
   - manager CRUD controls
   - manager filters for BD, year, and quarter

## API Changes

### Transactional Service (`project-sales-crm`)

Added or expanded:

- `GET /api/payments`
  - supports `dealId`, `bdId`, `year`, `quarter`
  - returns payment logs enriched with BD, client, and billing period data

- `GET /api/payments/overview`
  - returns collections summary, monthly trend, deal tracking, follow-up queue, and available filter years

- `POST /api/payments`
  - accepts `billingYear` and `billingMonth`

- `PATCH /api/payments/:id`
  - manager only

- `DELETE /api/payments/:id`
  - manager only

### Analytics Service (`crm-analytics-service`)

Added:

- `GET /api/analytics/reports/collections-overview`
  - returns summary
  - monthly trend of booked vs expected vs collected
  - BD breakdown
  - account breakdown
  - overdue accounts list

## Data Model Approach

No new billing tables were introduced in this phase.

The workflow is derived from existing data:

- `deal.startDate`
- `deal.duration`
- `deal.monthlySubscription`
- `deal.revenue`
- `payment.dateId`

This keeps implementation scoped while still enabling monthly subscription tracking and collections reporting.

## Acceptance Criteria

- payments can be logged against closed deals with a billing month and year
- BD reps only see their own payment logs and collections state
- sales managers can view all BD payment logs
- sales managers can filter logs by BD, year, and quarter
- sales managers can create, update, and delete payment logs
- the Payments page shows booked vs collected revenue
- the Payments page highlights unpaid and overdue accounts
- the Payments page shows monthly subscription tracking by deal
- analytics reporting compares booked revenue against actual receipts

## Risks / Constraints

- old payment rows without a billing period appear as `Unassigned`
- this feature tracks collections visibility, not full invoice lifecycle
- expected billing is derived from deal metadata, so incorrect deal start dates or durations will affect collections reporting

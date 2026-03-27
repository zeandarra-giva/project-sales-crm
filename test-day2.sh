#!/usr/bin/env bash
# ============================================================
# Day 2 Endpoint Tests — Dashboard, Services, Payments
# Run from project root: bash test-day2.sh
# Requires: server running (npm run dev) on localhost:3000
# ============================================================

BASE="http://localhost:3111"
PASS="\033[0;32m✓\033[0m"
FAIL="\033[0;31m✗\033[0m"
BOLD="\033[1m"
NC="\033[0m"

# ── Helpers ──────────────────────────────────────────────────

# Wrapper: curl that never causes script exit on connection failure
safe_curl() {
  curl -s -w "\n%{http_code}" --max-time 8 "$@" 2>/dev/null || echo -e "\nCONN_ERR"
}

check() {
  local label="$1"
  local status="$2"
  local body="$3"
  local expected_status="$4"
  local expect_key="$5"

  if [ "$status" = "CONN_ERR" ]; then
    echo -e "  ${FAIL} ${label} — server not reachable at $BASE"
    return
  fi
  if [ "$status" -eq "$expected_status" ]; then
    if [ -n "$expect_key" ] && ! echo "$body" | grep -q "$expect_key"; then
      echo -e "  ${FAIL} ${label} — got $status but missing key: '$expect_key'"
      echo "     body: $(echo $body | head -c 200)"
    else
      echo -e "  ${PASS} ${label} (HTTP $status)"
    fi
  else
    echo -e "  ${FAIL} ${label} — expected $expected_status, got $status"
    echo "     body: $(echo $body | head -c 300)"
  fi
}

# ── Server connectivity check ────────────────────────────────
echo -e "\n${BOLD}── Checking server at $BASE ─────────────────────────────────${NC}"
if ! curl -s --max-time 5 "$BASE/api/auth/login" -o /dev/null 2>/dev/null; then
  echo -e "  ${FAIL} Cannot reach $BASE — start the server first: npm run dev"
  exit 1
fi
echo -e "  ${PASS} Server is up at $BASE"

# ── 0. Auth tokens ────────────────────────────────────────────
echo -e "\n${BOLD}── Auth ─────────────────────────────────────────────────────${NC}"

BD_RESP=$(safe_curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"henne@company.com","password":"changeme123"}')
BD_BODY=$(echo "$BD_RESP" | head -n1)
BD_STATUS=$(echo "$BD_RESP" | tail -n1)
BD_TOKEN=$(echo "$BD_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
check "BD login (henne@company.com)" "$BD_STATUS" "$BD_BODY" 200 "token"
echo "     BD token: ${BD_TOKEN:0:40}..."

MGR_RESP=$(safe_curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@company.com","password":"changeme123"}')
MGR_BODY=$(echo "$MGR_RESP" | head -n1)
MGR_STATUS=$(echo "$MGR_RESP" | tail -n1)
MGR_TOKEN=$(echo "$MGR_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
check "Manager login (manager@company.com)" "$MGR_STATUS" "$MGR_BODY" 200 "token"

# ── 1. BD Dashboard ──────────────────────────────────────────
echo -e "\n${BOLD}── Task 2.1: BD Dashboard (/api/dashboard/bd) ──────────────${NC}"

RESP=$(safe_curl "$BASE/api/dashboard/bd" \
  -H "Authorization: Bearer $BD_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "BD: own dashboard (200)" "$STATUS" "$BODY" 200 "metrics"
check "BD: has dealsClosed" "$STATUS" "$BODY" 200 "dealsClosed"
check "BD: has closedRevenue" "$STATUS" "$BODY" 200 "closedRevenue"
check "BD: has openPipeline" "$STATUS" "$BODY" 200 "openPipeline"
check "BD: has quotaAttainment" "$STATUS" "$BODY" 200 "quotaAttainment"
check "BD: has salesForecast" "$STATUS" "$BODY" 200 "salesForecast"
check "BD: has pipelineByStage" "$STATUS" "$BODY" 200 "pipelineByStage"
check "BD: has openDeals" "$STATUS" "$BODY" 200 "openDeals"

# Manager views a specific BD
RESP=$(safe_curl "$BASE/api/dashboard/bd?bdId=&year=2026&quarter=1" \
  -H "Authorization: Bearer $MGR_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Manager: BD dashboard with quarter params" "$STATUS" "$BODY" 200 "metrics"

# Auth guard
RESP=$(safe_curl "$BASE/api/dashboard/bd")
STATUS=$(echo "$RESP" | tail -n1)
check "BD Dashboard: rejects unauthenticated" "$STATUS" "" 401 ""

# ── 2. Executive Dashboard ───────────────────────────────────
echo -e "\n${BOLD}── Task 2.2: Executive Dashboard (/api/dashboard/executive) ─${NC}"

RESP=$(safe_curl "$BASE/api/dashboard/executive" \
  -H "Authorization: Bearer $MGR_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Manager: executive dashboard (200)" "$STATUS" "$BODY" 200 "metrics"
check "Manager: has teamActual" "$STATUS" "$BODY" 200 "teamActual"
check "Manager: has teamQuota" "$STATUS" "$BODY" 200 "teamQuota"
check "Manager: has teamForecast" "$STATUS" "$BODY" 200 "teamForecast"
check "Manager: has attainment" "$STATUS" "$BODY" 200 "attainment"
check "Manager: has leaderboard" "$STATUS" "$BODY" 200 "leaderboard"
check "Manager: has stuckDeals" "$STATUS" "$BODY" 200 "stuckDeals"
check "Manager: has dealsByAccountType" "$STATUS" "$BODY" 200 "dealsByAccountType"
check "Manager: has servicePerformance" "$STATUS" "$BODY" 200 "servicePerformance"

# BD should get 403
RESP=$(safe_curl "$BASE/api/dashboard/executive" \
  -H "Authorization: Bearer $BD_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "BD Rep: blocked from executive dashboard (403)" "$STATUS" "$BODY" 403 "Forbidden"

# ── 3. Services ──────────────────────────────────────────────
echo -e "\n${BOLD}── Task 2.3a: Services (/api/services) ─────────────────────${NC}"

RESP=$(safe_curl "$BASE/api/services" \
  -H "Authorization: Bearer $BD_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Services: list (200)" "$STATUS" "$BODY" 200 ""
echo "     Sample: $(echo $BODY | head -c 150)"

RESP=$(safe_curl "$BASE/api/services")
STATUS=$(echo "$RESP" | tail -n1)
check "Services: rejects unauthenticated (401)" "$STATUS" "" 401 ""

# ── 4. Payments ──────────────────────────────────────────────
echo -e "\n${BOLD}── Task 2.3b: Payments (/api/payments) ─────────────────────${NC}"

# List payments (BD scope)
RESP=$(safe_curl "$BASE/api/payments" \
  -H "Authorization: Bearer $BD_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Payments: BD list (200)" "$STATUS" "$BODY" 200 ""
echo "     Count: $(echo $BODY | grep -o '"id"' | wc -l) payment(s)"

# List payments (Manager scope)
RESP=$(safe_curl "$BASE/api/payments" \
  -H "Authorization: Bearer $MGR_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Payments: Manager list all (200)" "$STATUS" "$BODY" 200 ""

# Get a real dealId first
echo -e "\n  [getting a real dealId to test POST /api/payments...]"
DEALS=$(curl -s --max-time 8 "$BASE/api/deals" -H "Authorization: Bearer $BD_TOKEN" 2>/dev/null)
DEAL_ID=$(echo "$DEALS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DEAL_ID" ]; then
  echo "     Using dealId: $DEAL_ID"

  RESP=$(safe_curl -X POST "$BASE/api/payments" \
    -H "Authorization: Bearer $BD_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"dealId\":\"$DEAL_ID\",\"amount\":5000}")
  BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
  check "Payments: POST create (201)" "$STATUS" "$BODY" 201 "amount"
  PAYMENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "     Created payment ID: $PAYMENT_ID"

  RESP=$(safe_curl "$BASE/api/payments?dealId=$DEAL_ID" \
    -H "Authorization: Bearer $BD_TOKEN")
  BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
  check "Payments: GET filter by dealId (200)" "$STATUS" "$BODY" 200 ""
else
  echo "     Skipping POST test — no deals found (seed data may be empty)"
fi

# Validation: missing amount
RESP=$(safe_curl -X POST "$BASE/api/payments" \
  -H "Authorization: Bearer $BD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dealId":"00000000-0000-0000-0000-000000000000"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "Payments: POST missing amount → 400" "$STATUS" "$BODY" 400 "Validation"

echo -e "\n${BOLD}── Done ─────────────────────────────────────────────────────${NC}\n"

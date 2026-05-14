# Stock Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent stock pool groups across upload, dashboard, comparison, and continuous ranking workflows.

**Architecture:** Add a `stock_groups` model and make batches and comparison results group-aware. Treat batch order inside a group as the continuity source, and keep legacy APIs working by resolving missing `groupId` to `每日火车股票池`.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL via `pg`, Vitest.

---

## File Structure

- Modify `src/types/index.ts` for `StockGroup`, group-aware batches, and comparison result keys.
- Modify `src/lib/compare-recalculate.ts` to compute comparison results from ordered group batches.
- Modify `src/lib/comparer.ts` to remove calendar-day continuity and accept batch/group metadata.
- Modify `src/lib/db.ts` for schema migration, group CRUD, group-aware batch/result queries, and scoped cache invalidation.
- Modify `src/lib/stocks-page-data.ts` for group-aware page payloads.
- Modify `src/lib/api.ts` for group API helpers and `groupId` query/body/form parameters.
- Add `src/app/api/stocks/groups/route.ts`.
- Modify stock API routes under `src/app/api/stocks/**/route.ts` to pass `groupId`.
- Modify `src/app/page.tsx`, `src/app/upload/page.tsx`, `src/app/compare/CompareContent.tsx`, and `src/app/ranking/RankingContent.tsx` to select groups.
- Add `src/app/settings/groups/page.tsx` for group management.
- Modify `src/components/Navbar.tsx` to include group settings entry if needed.
- Modify tests in `src/lib/compare-recalculate.test.ts`, `src/lib/stocks-page-data.test.ts`, and add focused tests for group helper behavior.

---

### Task 1: Type and Pure Comparison Rules

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/comparer.ts`
- Modify: `src/lib/compare-recalculate.ts`
- Test: `src/lib/compare-recalculate.test.ts`

- [ ] **Step 1: Write failing tests for group batch continuity**

Add tests that prove:

- first batch in a group produces no comparison job
- continuity counts adjacent uploads, not adjacent calendar days
- continuity resets when a stock is absent from an intermediate uploaded batch

Run: `pnpm test src/lib/compare-recalculate.test.ts`
Expected: FAIL because current code still uses calendar-day checks and lacks batch metadata in results.

- [ ] **Step 2: Implement minimal pure logic**

Update comparison result payloads to carry `batch_id` and `group_id`, and update `buildCompareResultsForBatches` to pass ordered historical batches/items into the comparer.

- [ ] **Step 3: Verify task tests**

Run: `pnpm test src/lib/compare-recalculate.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/types/index.ts src/lib/comparer.ts src/lib/compare-recalculate.ts src/lib/compare-recalculate.test.ts
git commit -m "feat: compute group batch comparison results"
```

---

### Task 2: Group-Aware Page Data Helpers

**Files:**
- Modify: `src/lib/stocks-page-data.ts`
- Modify: `src/lib/stocks-page-data.test.ts`

- [ ] **Step 1: Write failing tests for selected group/date resolution**

Add tests that prove `ComparePageData` carries groups and selected group id, and that date fallback uses the selected group's batch list.

Run: `pnpm test src/lib/stocks-page-data.test.ts`
Expected: FAIL because group fields are missing.

- [ ] **Step 2: Implement helper types and selection logic**

Add group fields to `DashboardOverview` and `ComparePageData`, plus helpers for resolving selected group/date without changing unrelated behavior.

- [ ] **Step 3: Verify task tests**

Run: `pnpm test src/lib/stocks-page-data.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/lib/stocks-page-data.ts src/lib/stocks-page-data.test.ts
git commit -m "feat: add group-aware page data helpers"
```

---

### Task 3: Database Schema and Repository Functions

**Files:**
- Modify: `src/lib/db.ts`
- Test: existing lib tests through TypeScript/import coverage

- [ ] **Step 1: Write failing import/type tests**

Add focused tests only if pure helpers are extracted from DB code. Otherwise rely on TypeScript build and route integration because `db.ts` requires `DATABASE_URL`.

Run: `pnpm test`
Expected: current tests still pass before DB edits.

- [ ] **Step 2: Implement schema migration**

Update `ensureTables` to:

- create `stock_groups`
- insert `每日火车股票池`
- add/backfill `group_id` on `stock_batches`
- add/backfill `batch_id` and `group_id` on `stock_compare_results`
- add group-aware indexes
- remove or replace old unique constraints where PostgreSQL permits idempotently

- [ ] **Step 3: Implement group and group-aware repository methods**

Add:

- `getDefaultGroup`
- `resolveGroupId`
- `getStockGroups`
- `createStockGroup`
- `updateStockGroup`
- group-aware `createBatch`, `getBatchByDate`, `getPreviousBatch`, `getAllBatches`, `getLatestBatch`
- group-aware compare result create/delete/query/ranking/dashboard/detail methods

- [ ] **Step 4: Verify TypeScript coverage**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/db.ts src/types/index.ts
git commit -m "feat: add stock group persistence"
```

---

### Task 4: API Routes and Upload Recalculation

**Files:**
- Modify: `src/lib/api.ts`
- Add: `src/app/api/stocks/groups/route.ts`
- Modify: `src/app/api/stocks/upload/route.ts`
- Modify: `src/app/api/stocks/upload/text/route.ts`
- Modify: `src/app/api/stocks/batches/route.ts`
- Modify: `src/app/api/stocks/batch/route.ts`
- Modify: `src/app/api/stocks/dashboard/route.ts`
- Modify: `src/app/api/stocks/compare/route.ts`
- Modify: `src/app/api/stocks/compare/page-data/route.ts`
- Modify: `src/app/api/stocks/compare/recalculate/route.ts`
- Modify: `src/app/api/stocks/ranking/route.ts`
- Modify: `src/app/api/stocks/detail/route.ts`

- [ ] **Step 1: Write failing route-adjacent tests where practical**

Prefer pure extraction for upload orchestration if route tests become heavy. At minimum, keep the pure recalculation tests from Task 1 covering replacement/rebuild semantics.

- [ ] **Step 2: Implement API group parameters**

Pass `groupId` through form data, JSON body, and query params. Resolve omitted `groupId` to the default group.

- [ ] **Step 3: Implement scoped recalculation**

On upload replacement, delete stale compare rows and rebuild only the selected group's affected batch range.

- [ ] **Step 4: Verify tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/api.ts src/app/api/stocks
git commit -m "feat: expose stock group APIs"
```

---

### Task 5: Dashboard, Upload, Compare, Ranking, and Group Settings UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/upload/page.tsx`
- Modify: `src/app/compare/CompareContent.tsx`
- Modify: `src/app/ranking/RankingContent.tsx`
- Add: `src/app/settings/groups/page.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Implement shared UI behavior using existing components/styles**

Add group selectors, URL propagation, baseline empty states, quick new-group action on upload, and settings CRUD page.

- [ ] **Step 2: Verify unit tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/app src/components src/lib/api.ts src/types/index.ts
git commit -m "feat: add stock group user flows"
```

---

### Task 6: Final Verification

**Files:**
- All touched files

- [ ] **Step 1: Run full tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Review git diff**

Run: `git status --short` and `git log --oneline -5`
Expected: only intended feature branch commits are present.

- [ ] **Step 4: Report implementation status**

Summarize completed behavior, verification output, branch/worktree location, and any residual risks.

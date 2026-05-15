# Ranking Table Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-to-use top filter block on the continuous ranking page with an Excel-like enriched ranking table.

**Architecture:** Keep the existing ranking API as the base data source, extend the enriched ranking row with net profit amount, and add focused client-side table helpers for filtering, sorting, formatting, and export/report visibility. The page owns draft filters, applied filters, and table sort state so users only change results after explicit actions.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL, Vitest.

---

## File Structure

- Modify `src/types/index.ts` to add net profit and revenue amounts to `RankingFinanceSnapshot`.
- Modify `src/lib/db.ts` to select latest `net_profit` and `revenue` in enriched ranking rows.
- Modify `src/lib/ranking-filters.ts` and tests for CSV/report summaries with net profit.
- Create `src/lib/ranking-table.ts` and `src/lib/ranking-table.test.ts` for pure table filtering, sorting, and formatting helpers.
- Modify `src/app/ranking/RankingContent.tsx` to replace the top multi-select block with an enriched sortable/filterable table.

## Tasks

### Task 1: Table Helper Tests and Implementation

- [ ] Add failing tests for industry search filtering, financial thresholds, sorting by net profit, and missing metric sort ordering.
- [ ] Implement `filterRankingTableRows`, `sortRankingTableRows`, `formatFinanceAmount`, and `formatPercent`.
- [ ] Run `pnpm test src/lib/ranking-table.test.ts`.
- [ ] Commit helper changes.

### Task 2: Net Profit Data Flow

- [ ] Add failing tests that CSV export includes net profit amount.
- [ ] Extend `RankingFinanceSnapshot` with `netProfit` and `revenue`.
- [ ] Update enriched ranking SQL mapping to return `net_profit` and `revenue`.
- [ ] Update CSV export and AI prompt context to include net profit amount.
- [ ] Run affected tests.
- [ ] Commit data-flow changes.

### Task 3: Ranking Page UX

- [ ] Replace native industry/concept multi-select controls with an explicit filter/search panel and table-level industry checkbox filter.
- [ ] Add sortable table headers for continuous days, appearances, net profit, net profit YoY, revenue YoY, and ROE.
- [ ] Add table columns for industry, concepts, report period, net profit, and growth metrics.
- [ ] Keep CSV export and AI report generation based on currently visible rows.
- [ ] Add empty-state messaging that shows active filters and reset action.
- [ ] Run `pnpm build`.
- [ ] Commit UI changes.

### Task 4: Final Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Start dev server and verify `/ranking`, ranking API, and metadata enrichment.
- [ ] Push `feature/ranking-ai-filters`.

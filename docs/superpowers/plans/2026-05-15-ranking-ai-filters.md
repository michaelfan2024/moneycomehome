# Ranking AI Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add industry, concept, and financial filtering to continuous ranking, then export or generate AI reports from the filtered ranking list.

**Architecture:** Keep the existing group-aware ranking as the base query, enrich ranking rows with cached stock metadata and latest financial data, and apply filter semantics through focused helper functions that are easy to test. Reuse the existing AI/report generation pipeline by adding a source type and ranking-specific context rather than creating a separate report system.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL via `pg`, Vitest, existing AI/report infrastructure.

---

## File Structure

- Create `src/lib/ranking-filters.ts` for pure ranking filter, CSV, option, and summary helpers.
- Create `src/lib/ranking-filters.test.ts` for filter and CSV behavior.
- Create `src/lib/stock-metadata.ts` for provider-facing stock industry/concept normalization and stale checks.
- Create `src/lib/stock-metadata.test.ts` for metadata normalization and stale policy.
- Modify `src/types/index.ts` to add `StockMetadata`, enriched ranking row types, and ranking filter input types.
- Modify `src/lib/db-schema.ts` and `src/lib/db-schema.test.ts` to include metadata readiness.
- Modify `src/lib/db.ts` to create `stock_metadata`, upsert/read metadata, fetch enriched ranking rows, and apply SQL-safe filters where practical.
- Add `src/app/api/stocks/metadata/enrich/route.ts` for metadata enrichment.
- Modify `src/app/api/stocks/ranking/route.ts` to parse filter params and return enriched ranking rows.
- Modify `src/lib/api.ts` for ranking filter params and metadata enrichment API helpers.
- Modify `src/lib/analysis-template.ts` to support ranking-specific prompt context.
- Modify `src/lib/ai-analysis.ts` to pass report source context into prompt building.
- Modify `src/app/api/report/generate/route.ts` to accept `sourceType: "compare" | "ranking"` and ranking filter summary.
- Modify `src/lib/report-store.ts` and `src/app/report/[id]/page.tsx` so report metadata no longer assumes every report is a new-stock report.
- Modify `src/app/report/generate/GenerateReportContent.tsx` to load either compare/new-stock data or ranking result data from URL/source payload.
- Modify `src/app/ranking/RankingContent.tsx` to add filters, enrichment status, CSV export, and AI report entry.

---

### Task 1: Pure Ranking Filter and CSV Helpers

**Files:**
- Create: `src/lib/ranking-filters.ts`
- Create: `src/lib/ranking-filters.test.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write failing tests for filter semantics**

Add tests in `src/lib/ranking-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildRankingFilterSummary,
  exportRankingRowsToCsv,
  filterRankingRows,
  getRankingFilterOptions
} from './ranking-filters'
import type { EnrichedRankingResult, RankingFilters } from '../types'

const rows: EnrichedRankingResult[] = [
  {
    id: '1',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '688001',
    stock_name: '半导体A',
    status: 'continued',
    continuous_count: 5,
    total_appear_count: 8,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '半导体',
    concepts: ['芯片', '人工智能'],
    finance: { netProfitYoy: 60, revenueYoy: 35, roe: 12 }
  },
  {
    id: '2',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '300001',
    stock_name: '软件B',
    status: 'continued',
    continuous_count: 4,
    total_appear_count: 4,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '软件开发',
    concepts: ['信创'],
    finance: { netProfitYoy: 20, revenueYoy: 40, roe: 8 }
  },
  {
    id: '3',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '600001',
    stock_name: '医药C',
    status: 'continued',
    continuous_count: 3,
    total_appear_count: 6,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '化学制药',
    concepts: ['创新药'],
    finance: {}
  }
]

describe('filterRankingRows', () => {
  it('uses OR within industries and concepts, AND across filter families', () => {
    const filters: RankingFilters = {
      industries: ['半导体', '软件开发'],
      concepts: ['芯片'],
      netProfitGrowthMin: 50,
      revenueGrowthMin: 30
    }

    expect(filterRankingRows(rows, filters).map((row) => row.stock_code)).toEqual(['688001'])
  })

  it('does not match rows with missing financial metrics when a metric filter is active', () => {
    expect(filterRankingRows(rows, { netProfitGrowthMin: 1 }).map((row) => row.stock_code)).toEqual(['688001', '300001'])
  })
})

describe('CSV and options', () => {
  it('builds unique industry and concept options from rows', () => {
    expect(getRankingFilterOptions(rows).industries).toEqual(['化学制药', '半导体', '软件开发'])
    expect(getRankingFilterOptions(rows).concepts).toEqual(['人工智能', '信创', '创新药', '芯片'])
  })

  it('exports the filtered rows with ranking and enrichment fields', () => {
    const csv = exportRankingRowsToCsv([rows[0]], {
      groupName: '每日火车股票池',
      minDays: 3,
      filters: { industries: ['半导体'], netProfitGrowthMin: 50 }
    })

    expect(csv).toContain('股票代码,股票名称,连续天数')
    expect(csv).toContain('688001,半导体A,5')
    expect(csv).toContain('半导体')
    expect(csv).toContain('净利润同比>=50%')
  })

  it('summarizes active filters for reports and export', () => {
    expect(buildRankingFilterSummary({
      groupName: '每日火车股票池',
      minDays: 5,
      filters: { concepts: ['芯片', '人工智能'], roeMin: 10 }
    })).toContain('连续5天+')
  })
})
```

Run: `pnpm test src/lib/ranking-filters.test.ts`

Expected: FAIL because `ranking-filters.ts` and types do not exist.

- [ ] **Step 2: Add ranking filter types**

Modify `src/types/index.ts`:

```ts
export interface StockMetadata {
  stock_code: string
  stock_name: string
  industry?: string | null
  concepts: string[]
  source?: string | null
  fetched_at?: string
  updated_at?: string
}

export interface RankingFinanceSnapshot {
  reportDate?: string
  reportType?: string
  netProfitYoy?: number | null
  revenueYoy?: number | null
  roe?: number | null
}

export interface EnrichedRankingResult extends StockCompareResult {
  industry?: string | null
  concepts?: string[]
  finance?: RankingFinanceSnapshot
}

export interface RankingFilters {
  industries?: string[]
  concepts?: string[]
  netProfitGrowthMin?: number | null
  revenueGrowthMin?: number | null
  roeMin?: number | null
}

export interface RankingExportContext {
  groupName?: string
  minDays: number
  filters: RankingFilters
}
```

- [ ] **Step 3: Implement pure helpers**

Create `src/lib/ranking-filters.ts`:

```ts
import type { EnrichedRankingResult, RankingExportContext, RankingFilters } from '../types'

function normalizeList(values?: string[] | null): string[] {
  return (values || []).map((value) => value.trim()).filter(Boolean)
}

function matchesAny(selected: string[], actualValues: string[]): boolean {
  return selected.length === 0 || actualValues.some((value) => selected.includes(value))
}

function metricMatches(value: number | null | undefined, min: number | null | undefined): boolean {
  if (min === undefined || min === null || Number.isNaN(min)) {
    return true
  }
  return typeof value === 'number' && value >= min
}

export function filterRankingRows(rows: EnrichedRankingResult[], filters: RankingFilters): EnrichedRankingResult[] {
  const industries = normalizeList(filters.industries)
  const concepts = normalizeList(filters.concepts)

  return rows.filter((row) => {
    const rowIndustry = row.industry ? [row.industry] : []
    const rowConcepts = row.concepts || []

    return matchesAny(industries, rowIndustry)
      && matchesAny(concepts, rowConcepts)
      && metricMatches(row.finance?.netProfitYoy, filters.netProfitGrowthMin)
      && metricMatches(row.finance?.revenueYoy, filters.revenueGrowthMin)
      && metricMatches(row.finance?.roe, filters.roeMin)
  })
}

export function getRankingFilterOptions(rows: EnrichedRankingResult[]): { industries: string[]; concepts: string[] } {
  const industries = new Set<string>()
  const concepts = new Set<string>()

  rows.forEach((row) => {
    if (row.industry) {
      industries.add(row.industry)
    }
    ;(row.concepts || []).forEach((concept) => concepts.add(concept))
  })

  return {
    industries: [...industries].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    concepts: [...concepts].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildRankingFilterSummary(context: RankingExportContext): string {
  const parts = [`连续${context.minDays}天+`]
  if (context.groupName) parts.push(`分组=${context.groupName}`)
  if (context.filters.industries?.length) parts.push(`行业=${context.filters.industries.join('/')}`)
  if (context.filters.concepts?.length) parts.push(`概念=${context.filters.concepts.join('/')}`)
  if (context.filters.netProfitGrowthMin !== undefined && context.filters.netProfitGrowthMin !== null) {
    parts.push(`净利润同比>=${context.filters.netProfitGrowthMin}%`)
  }
  if (context.filters.revenueGrowthMin !== undefined && context.filters.revenueGrowthMin !== null) {
    parts.push(`营收同比>=${context.filters.revenueGrowthMin}%`)
  }
  if (context.filters.roeMin !== undefined && context.filters.roeMin !== null) {
    parts.push(`ROE>=${context.filters.roeMin}%`)
  }
  return parts.join('；')
}

export function exportRankingRowsToCsv(rows: EnrichedRankingResult[], context: RankingExportContext): string {
  const summary = buildRankingFilterSummary(context)
  const headers = ['股票代码', '股票名称', '连续天数', '总出现次数', '最近出现日期', '行业', '概念', '净利润同比', '营收同比', 'ROE', '分组', '筛选条件']
  const lines = rows.map((row) => [
    row.stock_code,
    row.stock_name,
    row.continuous_count,
    row.total_appear_count,
    row.last_seen_date || row.trade_date,
    row.industry || '未分类',
    (row.concepts || []).join('/'),
    row.finance?.netProfitYoy ?? '',
    row.finance?.revenueYoy ?? '',
    row.finance?.roe ?? '',
    context.groupName || '',
    summary
  ].map(csvCell).join(','))

  return ['\uFEFF' + headers.join(','), ...lines].join('\n')
}
```

- [ ] **Step 4: Verify task tests**

Run: `pnpm test src/lib/ranking-filters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/ranking-filters.ts src/lib/ranking-filters.test.ts
git commit -m "feat: add ranking filter helpers"
```

---

### Task 2: Stock Metadata Schema and Repository

**Files:**
- Modify: `src/lib/db-schema.ts`
- Modify: `src/lib/db-schema.test.ts`
- Modify: `src/lib/db.ts`
- Test: `src/lib/db-schema.test.ts`

- [ ] **Step 1: Write failing schema readiness tests**

Extend `src/lib/db-schema.test.ts` so a ready schema requires:

```ts
stock_metadata_table_exists: true,
stock_metadata_stock_code_key_exists: true
```

Add a test that returns false when `stock_metadata_table_exists` is false.

Run: `pnpm test src/lib/db-schema.test.ts`

Expected: FAIL because readiness type does not include metadata fields.

- [ ] **Step 2: Extend readiness type and checks**

Modify `src/lib/db-schema.ts` to add:

```ts
stock_metadata_table_exists: boolean
stock_metadata_stock_code_key_exists: boolean
```

Modify `getStockGroupSchemaReadiness` in `src/lib/db.ts` to query:

```sql
(to_regclass('public.stock_metadata') IS NOT NULL) as stock_metadata_table_exists,
EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'stock_metadata_stock_code_key'
) as stock_metadata_stock_code_key_exists
```

- [ ] **Step 3: Add table creation and indexes**

Modify `ensureTables` in `src/lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS stock_metadata (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(20) NOT NULL UNIQUE,
  stock_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  source VARCHAR(100),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_metadata_stock_code_key UNIQUE(stock_code)
)
```

Add indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_stock_metadata_industry ON stock_metadata(industry)
CREATE INDEX IF NOT EXISTS idx_stock_metadata_concepts ON stock_metadata USING GIN(concepts)
CREATE INDEX IF NOT EXISTS idx_stock_metadata_fetched_at ON stock_metadata(fetched_at DESC)
```

- [ ] **Step 4: Add repository methods**

Modify `src/lib/db.ts`:

```ts
export async function getStockMetadataByCodes(stockCodes: string[]): Promise<StockMetadata[]>
export async function upsertStockMetadata(metadata: Omit<StockMetadata, 'fetched_at' | 'updated_at'>[]): Promise<StockMetadata[] | null>
```

Use parameterized SQL. Return concepts as `string[]`.

- [ ] **Step 5: Verify schema tests and build**

Run:

```bash
pnpm test src/lib/db-schema.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db-schema.ts src/lib/db-schema.test.ts src/lib/db.ts
git commit -m "feat: add stock metadata cache"
```

---

### Task 3: Metadata Provider and Enrichment API

**Files:**
- Create: `src/lib/stock-metadata.ts`
- Create: `src/lib/stock-metadata.test.ts`
- Add: `src/app/api/stocks/metadata/enrich/route.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Write failing provider tests**

Create `src/lib/stock-metadata.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { isStockMetadataStale, normalizeStockMetadata, parseEastmoneyMetadataPayload } from './stock-metadata'

describe('stock metadata helpers', () => {
  it('normalizes industry and concepts without empty values', () => {
    expect(normalizeStockMetadata({
      stock_code: '688001',
      stock_name: '半导体A',
      industry: ' 半导体 ',
      concepts: ['芯片', '', ' 人工智能 ', '芯片'],
      source: 'eastmoney'
    })).toEqual({
      stock_code: '688001',
      stock_name: '半导体A',
      industry: '半导体',
      concepts: ['芯片', '人工智能'],
      source: 'eastmoney'
    })
  })

  it('treats metadata older than seven days as stale', () => {
    vi.setSystemTime(new Date('2026-05-15T00:00:00Z'))
    expect(isStockMetadataStale('2026-05-01T00:00:00Z')).toBe(true)
    expect(isStockMetadataStale('2026-05-14T00:00:00Z')).toBe(false)
    vi.useRealTimers()
  })

  it('parses provider payload into normalized metadata', () => {
    const parsed = parseEastmoneyMetadataPayload('688001', '半导体A', {
      INDUSTRY: '半导体',
      CONCEPT: '芯片;人工智能;国产替代'
    })

    expect(parsed?.industry).toBe('半导体')
    expect(parsed?.concepts).toEqual(['芯片', '人工智能', '国产替代'])
  })
})
```

Run: `pnpm test src/lib/stock-metadata.test.ts`

Expected: FAIL because helper file does not exist.

- [ ] **Step 2: Implement metadata helper module**

Create `src/lib/stock-metadata.ts` with:

```ts
import type { StockMetadata } from '../types'

export const STOCK_METADATA_STALE_DAYS = 7

export function normalizeStockMetadata(input: Omit<StockMetadata, 'fetched_at' | 'updated_at'>): Omit<StockMetadata, 'fetched_at' | 'updated_at'> {
  const concepts = [...new Set((input.concepts || []).map((item) => item.trim()).filter(Boolean))]
  return {
    stock_code: String(input.stock_code).trim(),
    stock_name: String(input.stock_name).trim(),
    industry: input.industry?.trim() || null,
    concepts,
    source: input.source || null
  }
}

export function isStockMetadataStale(fetchedAt?: string | null, now = new Date()): boolean {
  if (!fetchedAt) return true
  const fetched = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetched)) return true
  return now.getTime() - fetched > STOCK_METADATA_STALE_DAYS * 24 * 60 * 60 * 1000
}

export function parseEastmoneyMetadataPayload(stockCode: string, stockName: string, payload: Record<string, unknown>): Omit<StockMetadata, 'fetched_at' | 'updated_at'> | null {
  const industry = String(payload.INDUSTRY || payload.INDUSTRY_NAME || payload.BK_NAME || '').trim()
  const conceptText = String(payload.CONCEPT || payload.CONCEPTS || payload.CONCEPT_NAME || '')
  const concepts = conceptText.split(/[;,，、]/).map((item) => item.trim()).filter(Boolean)
  if (!industry && concepts.length === 0) return null
  return normalizeStockMetadata({ stock_code: stockCode, stock_name: stockName, industry, concepts, source: 'eastmoney' })
}
```

Add a first provider function with a conservative fallback:

```ts
export async function fetchStockMetadata(stockCode: string, stockName: string): Promise<Omit<StockMetadata, 'fetched_at' | 'updated_at'> | null> {
  // Implement provider-specific Eastmoney fetch in a small adapter.
  // If the endpoint returns an unexpected shape, return null and let UI show 未分类.
}
```

- [ ] **Step 3: Add enrichment route**

Create `src/app/api/stocks/metadata/enrich/route.ts`:

- Accept `{ stocks: Array<{ stock_code: string; stock_name: string }> }`.
- Read cached metadata using `getStockMetadataByCodes`.
- Fetch only missing or stale records.
- Upsert fetched records.
- Return combined metadata and counts: `requested`, `cached`, `fetched`, `failed`.

- [ ] **Step 4: Add API client helper**

Modify `src/lib/api.ts`:

```ts
export async function enrichStockMetadata(stocks: Array<{ stock_code: string; stock_name: string }>): Promise<{
  success: boolean
  data?: { metadata: StockMetadata[]; requested: number; cached: number; fetched: number; failed: number }
  error?: string
}> {
  const response = await fetch('/api/stocks/metadata/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stocks })
  })
  return response.json()
}
```

- [ ] **Step 5: Verify provider tests and build**

Run:

```bash
pnpm test src/lib/stock-metadata.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stock-metadata.ts src/lib/stock-metadata.test.ts src/app/api/stocks/metadata/enrich/route.ts src/lib/api.ts
git commit -m "feat: add stock metadata enrichment"
```

---

### Task 4: Enriched Ranking API

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/stocks/ranking/route.ts`
- Modify: `src/lib/api.ts`
- Test: `src/lib/ranking-filters.test.ts`

- [ ] **Step 1: Add parsing tests for ranking filter query if helper is extracted**

If query parsing is extracted to `src/lib/ranking-filters.ts`, add tests for:

```ts
parseRankingFiltersFromParams(new URLSearchParams('industries=半导体,软件开发&concepts=芯片&netProfitGrowthMin=50'))
```

Run: `pnpm test src/lib/ranking-filters.test.ts`

Expected: FAIL before parser exists.

- [ ] **Step 2: Add enriched ranking repository method**

Modify `src/lib/db.ts` to add:

```ts
export async function getEnrichedContinuousRanking(
  minDays = 2,
  groupId?: string | number | null,
  filters: RankingFilters = {}
): Promise<EnrichedRankingResult[] | null>
```

Implementation:

- Start from latest-batch ranking rows.
- Left join `stock_metadata`.
- Left join latest financial report per stock via `DISTINCT ON (stock_code)` or a lateral subquery.
- Return:
  - `industry`
  - `concepts`
  - `finance.reportDate`
  - `finance.reportType`
  - `finance.netProfitYoy`
  - `finance.revenueYoy`
  - `finance.roe`
- Apply SQL filters:
  - industry list with `= ANY($n)`
  - concepts with JSONB containment or overlap
  - financial thresholds with numeric comparisons
- Keep `getContinuousRanking` for backward compatibility, or make it call the enriched method and strip extra fields only if needed.

- [ ] **Step 3: Update ranking API route**

Modify `src/app/api/stocks/ranking/route.ts`:

- Parse `industries`, `concepts`, `netProfitGrowthMin`, `revenueGrowthMin`, `roeMin`.
- Call `getEnrichedContinuousRanking`.
- Return enriched rows.

- [ ] **Step 4: Update API client**

Modify `src/lib/api.ts`:

```ts
export async function getRanking(
  minDays = 2,
  groupId?: string,
  filters?: RankingFilters
): Promise<{ success: boolean; data: EnrichedRankingResult[] | null }> {
  const params = new URLSearchParams({ minDays: String(minDays) })
  // append filters
  const response = await fetch(withGroupParam(`/api/stocks/ranking?${params.toString()}`, groupId))
  return response.json()
}
```

- [ ] **Step 5: Verify tests and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/app/api/stocks/ranking/route.ts src/lib/api.ts src/lib/ranking-filters.ts src/lib/ranking-filters.test.ts
git commit -m "feat: return enriched ranking results"
```

---

### Task 5: Ranking AI Report Source

**Files:**
- Modify: `src/lib/analysis-template.ts`
- Modify: `src/lib/ai-analysis.ts`
- Modify: `src/app/api/report/generate/route.ts`
- Modify: `src/lib/report-store.ts`
- Modify: `src/app/report/[id]/page.tsx`
- Test: `src/lib/analysis-template.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Modify `src/lib/analysis-template.test.ts` to assert:

- `buildPromptFromTemplate` defaults to daily new-stock wording.
- Ranking source context changes wording to continuous ranking.
- Ranking prompt includes filter summary.
- Ranking prompt includes enrichment fields and warns against missing data inference.

Example:

```ts
it('builds a ranking report prompt without daily-new-stock wording', () => {
  const prompt = buildPromptFromTemplate(DEFAULT_TEMPLATE, [{
    stock_code: '688001',
    stock_name: '半导体A',
    continuous_count: 5,
    total_appear_count: 8,
    industry: '半导体',
    concepts: ['芯片'],
    finance: { netProfitYoy: 60 }
  }], '2026-05-15', undefined, {
    sourceType: 'ranking',
    title: '连续3天+股票AI分析报告',
    filterSummary: '连续3天+；行业=半导体'
  })

  expect(prompt).toContain('连续榜单')
  expect(prompt).toContain('连续3天+；行业=半导体')
  expect(prompt).not.toContain('今日新增股票')
})
```

Run: `pnpm test src/lib/analysis-template.test.ts`

Expected: FAIL because report source context is unsupported.

- [ ] **Step 2: Add report source types**

Modify `src/types/index.ts` or `src/lib/analysis-template.ts`:

```ts
export type ReportSourceType = 'compare' | 'ranking'

export interface ReportPromptContext {
  sourceType?: ReportSourceType
  title?: string
  filterSummary?: string
}
```

- [ ] **Step 3: Extend prompt builder**

Modify `buildPromptFromTemplate` signature:

```ts
export function buildPromptFromTemplate(
  template: AnalysisTemplate,
  stocks: any[],
  date: string,
  financeContext?: string,
  reportContext?: ReportPromptContext
): string
```

For `sourceType === 'ranking'`, build stock context with:

- `📅 日期`
- `📈 连续榜单股票`
- `筛选条件`
- Stock rows including industry, concepts, continuous count, total appearances, and available financial metrics.
- Explicit instruction not to infer missing RPS/platform/financial data.

- [ ] **Step 4: Pass report context through AI call**

Modify `callAIAnalysis` in `src/lib/ai-analysis.ts`:

```ts
export async function callAIAnalysis(
  stocks: StockCompareResult[],
  date: string,
  template = DEFAULT_TEMPLATE,
  financeContext?: string,
  reportContext?: ReportPromptContext
)
```

- [ ] **Step 5: Extend report generation API**

Modify `src/app/api/report/generate/route.ts` to accept:

```ts
const { date, stocks, template, sourceType = 'compare', filterSummary, reportTitle } = body
```

Use title:

- compare: existing `${date} 新增股票AI分析报告`
- ranking: `reportTitle || `${date} 连续榜单AI分析报告``

Pass `reportContext` to `callAIAnalysis`.

Store report metadata in `Report`:

```ts
sourceType?: 'compare' | 'ranking'
filterSummary?: string
```

- [ ] **Step 6: Update report display labels**

Modify `src/app/report/[id]/page.tsx`:

- Download file name should use `report.title`.
- Subtitle should say:
  - compare: `${date} · ${stockCount}只新增股票`
  - ranking: `${date} · ${stockCount}只榜单股票`
- Show filter summary if present.

- [ ] **Step 7: Verify prompt tests and build**

Run:

```bash
pnpm test src/lib/analysis-template.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/analysis-template.ts src/lib/analysis-template.test.ts src/lib/ai-analysis.ts src/app/api/report/generate/route.ts src/lib/report-store.ts 'src/app/report/[id]/page.tsx' src/types/index.ts
git commit -m "feat: support ranking ai reports"
```

---

### Task 6: Ranking Page Filters, Export, and Report Entry

**Files:**
- Modify: `src/app/ranking/RankingContent.tsx`
- Modify: `src/lib/api.ts`
- Test: covered by pure helpers and build

- [ ] **Step 1: Update ranking state and data loading**

Modify `src/app/ranking/RankingContent.tsx`:

- Use `EnrichedRankingResult[]`.
- Track selected industries and concepts as arrays.
- Track financial inputs:
  - `netProfitGrowthMin`
  - `revenueGrowthMin`
  - `roeMin`
- Fetch base ranking with `getRanking(minDays, selectedGroupId)`.
- Apply client-side `filterRankingRows` to support immediate UI filtering.
- Use `getRankingFilterOptions` to populate industry/concept controls.

- [ ] **Step 2: Add enrichment status and action**

Add button:

```text
补全行业/概念数据
```

On click:

- Call `enrichStockMetadata(results.map(...))`.
- Refetch ranking data after enrichment.
- Show counts: requested, cached, fetched, failed.

- [ ] **Step 3: Add filter controls**

Add compact controls in existing filter card:

- Industry multi-select or checkbox list.
- Concept multi-select or checkbox list.
- Numeric inputs for financial filters.

For first implementation, use native multi-selects and numeric inputs to avoid adding dependencies.

- [ ] **Step 4: Add CSV export**

Use `exportRankingRowsToCsv(filteredResults, { groupName, minDays, filters })`.

Button:

```text
导出CSV ({filteredResults.length}条)
```

Disable when `filteredResults.length === 0`.

- [ ] **Step 5: Add AI report button**

Button:

```text
生成AI分析报告
```

On click:

- POST directly to `/api/report/generate` with:
  - `sourceType: 'ranking'`
  - `date: new Date().toISOString().split('T')[0]`
  - `stocks: filteredResults`
  - `filterSummary`
  - `reportTitle`
- Redirect to existing WeChat editor URL after success, matching compare report flow.
- If list is large, show confirm message before generating.

- [ ] **Step 6: Verify build and manual smoke**

Run:

```bash
pnpm test
pnpm build
```

Start dev server:

```bash
pnpm exec next dev --webpack -p 3002
```

Smoke test:

```bash
curl -s -o /tmp/ranking.json -w 'ranking %{http_code} %{time_total}\n' 'http://localhost:3002/api/stocks/ranking?minDays=3'
```

Expected:

- Ranking API returns `200`.
- `/ranking` renders.
- CSV export works for current filter.
- AI report button either generates a report or shows existing AI config error if config is missing.

- [ ] **Step 7: Commit**

```bash
git add src/app/ranking/RankingContent.tsx src/lib/api.ts
git commit -m "feat: add ranking filters export and ai entry"
```

---

### Task 7: Final Verification and Push

**Files:**
- All changed files

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Check git status**

Run:

```bash
git status --short --branch
```

Expected: clean except ignored `.env.local` symlink.

- [ ] **Step 3: Push feature branch**

Run:

```bash
git push -u origin feature/ranking-ai-filters
```

- [ ] **Step 4: Report outcome**

Report:

- branch name
- commit list
- verification commands and results
- any known limitations, especially provider endpoint limitations if industry/concept enrichment is partial

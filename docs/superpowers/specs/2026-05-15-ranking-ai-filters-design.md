# Ranking Filters and AI Report Design

## Goal

Upgrade the continuous ranking page from a simple continuity list into a filtered research workflow. Users should be able to narrow the ranking by group, continuity, industry, concept, and financial metrics, then export the filtered list as CSV or generate an AI report from exactly that filtered result set.

## Approved Decisions

- Industry and concept data should be fetched automatically by stock code.
- Users should not need to upload industry or concept columns.
- Both industry and concept filters are in scope.
- Financial filters are in scope, starting with metrics such as quarterly net profit growth, revenue growth, and ROE.
- AI reports should be generated from the current filtered ranking list, not from the unfiltered ranking.
- CSV export should export the current filtered ranking list.

## User Flow

1. User opens the continuous ranking page.
2. User selects a stock group.
3. User selects a minimum continuity threshold, such as 3 days or 5 days.
4. System shows ranking rows from that group and threshold.
5. System enriches visible stocks with industry, concept, and financial data from local cache.
6. Missing enrichment data can be fetched on demand from remote data providers and then cached.
7. User applies filters:
   - Industry filter
   - Concept filter
   - Financial filters
8. The ranking table updates to the filtered result set.
9. User can export that filtered result set to CSV.
10. User can generate an AI report from that filtered result set.

## Filter Semantics

Filtering is applied after the existing group and continuity ranking query.

Within one filter family:

- Multiple selected industries use OR.
- Multiple selected concepts use OR.

Across filter families:

- Group, continuity, industry, concept, and financial filters use AND.
- Multiple financial conditions use AND.

Example:

```text
Group = 每日火车股票池
Minimum continuity = 3 days
Industry = 半导体 OR 软件开发
Concept = 芯片 OR 人工智能
Net profit growth Q1 > 50%
Revenue growth Q1 > 30%
```

The final list contains only stocks that are in the selected group, meet the continuity threshold, belong to one selected industry, match one selected concept, and satisfy all financial thresholds.

## Data Model

Add a stock metadata cache table:

```text
stock_metadata
- stock_code
- stock_name
- industry
- concepts
- source
- fetched_at
- updated_at
```

`concepts` should be stored as structured JSON or text array, depending on the existing PostgreSQL compatibility needs. A stock can belong to multiple concepts.

Reuse the existing `stock_financial_reports` cache for financial data where possible. Add derived-query helpers rather than duplicating financial metrics into ranking rows.

If a required financial metric is not present in the latest cached report, the stock should be treated as not matching that financial condition unless the user explicitly disables that condition.

## Data Enrichment

Create a provider layer for stock metadata:

- Input: stock code and stock name.
- Output: industry and concept list.
- Responsibility: fetch remote data, normalize names, and return a stable local shape.

The first implementation can use Eastmoney-compatible market data endpoints if available. The adapter must isolate provider-specific response parsing so the rest of the app only depends on normalized metadata.

Remote fetches should not block every ranking page load. The page should use cached data first and provide an explicit enrichment action when data is missing or stale.

Recommended stale policy:

- Metadata cache: refresh after 7 days.
- Financial cache: reuse the latest available financial report, with an explicit refresh path when generating reports or applying financial filters.

## API Design

Extend ranking data APIs rather than creating a separate ranking system.

Add or extend APIs:

- `GET /api/stocks/ranking`
  - Existing params: `groupId`, `minDays`
  - New optional params:
    - `industries`
    - `concepts`
    - `netProfitGrowthMin`
    - `revenueGrowthMin`
    - `roeMin`
- `POST /api/stocks/metadata/enrich`
  - Body: stock list or stock codes
  - Fetches and caches missing or stale industry/concept data.
- `POST /api/report/generate`
  - Add report source support so ranking reports are titled and prompted as continuous ranking reports rather than daily new-stock reports.

If filtering can be done efficiently in SQL, the ranking API should return already filtered results. If the first version keeps filtering client-side, the API still needs to return metadata and financial fields needed for export and report generation.

## Page Design

Continuous ranking page additions:

- Keep group selector.
- Keep minimum continuity selector.
- Add industry multi-select.
- Add concept multi-select.
- Add financial filter controls:
  - Net profit growth minimum
  - Revenue growth minimum
  - ROE minimum
- Add an enrichment status area:
  - Shows how many rows have industry/concept data.
  - Allows "补全行业/概念数据" when metadata is missing.
- Add `导出CSV` button.
- Add `生成AI分析报告` button.

CSV export should include:

- Stock code
- Stock name
- Continuous count
- Total appearance count
- Last seen date
- Industry
- Concepts
- Financial metrics used by active filters
- Group name
- Ranking filter summary

## AI Report Design

The AI report should analyze the current filtered ranking result set.

Report context must include:

- Group name.
- Minimum continuity threshold.
- Selected industries.
- Selected concepts.
- Financial thresholds.
- Stock count after filtering.
- Filtered stock list with continuity, total appearance count, industry, concepts, and available financial metrics.

The report title should reflect ranking scope:

```text
YYYY-MM-DD 连续3天+股票AI分析报告
```

or, when filters are present:

```text
YYYY-MM-DD 半导体连续3天+股票AI分析报告
```

Prompting rules:

- AI may use CAN SLIM, Stock Market Wizards style principles, and Tao-style growth/relative-strength thinking as an analysis framework.
- AI must not claim a stock has high RPS, platform breakout, or strong quarterly profit growth unless that data is present in the provided context.
- Missing data should be called out as missing data, not inferred.
- The report should summarize the full filtered list and provide deeper analysis for the strongest candidates based on available fields.

## Report Generation Flow

1. Ranking page builds the current filtered result set.
2. User clicks `生成AI分析报告`.
3. Page sends source type `ranking`, filter summary, and filtered stocks to report generation.
4. Server fetches or reuses latest financial data for those stocks.
5. Server builds finance context and ranking context.
6. Server calls existing AI provider using the selected template.
7. Server saves the report using existing report storage.
8. User is redirected to the existing WeChat editor flow.

## Error Handling

- If AI config is missing, show the existing AI config error.
- If metadata enrichment fails for some stocks, keep those rows visible as `未分类`.
- If financial data is missing for a stock, keep the stock visible unless the active financial filters require the missing metric.
- If a filtered result set is empty, disable CSV export and report generation.
- If the filtered result set is very large, warn the user that report generation may be slow and costly.

## Testing Requirements

Unit tests should cover:

- Industry filter OR semantics.
- Concept filter OR semantics.
- Cross-family AND semantics.
- Multiple financial filter AND semantics.
- Missing financial metrics do not match active financial filters.
- CSV rows are generated from the filtered result set.
- Ranking report payload includes filter summary and ranking source type.

Route or integration tests should cover:

- Ranking API with metadata filters.
- Metadata enrichment API with cached and missing data.
- Report generation for source type `ranking`.
- Existing daily comparison report generation remains unchanged.

Run:

- `pnpm test`
- `pnpm build`

## Out of Scope

- Manual editing of industry or concept values.
- Full RPS calculation.
- Technical pattern detection such as platform breakout or volume breakout.
- A proprietary industry taxonomy.
- Portfolio management or buy/sell recommendation automation.

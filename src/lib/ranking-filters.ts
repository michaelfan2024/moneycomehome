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
    industries: [...industries].sort(),
    concepts: [...concepts].sort(),
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
  if (context.groupName) {
    parts.push(`分组=${context.groupName}`)
  }
  if (context.filters.industries?.length) {
    parts.push(`行业=${context.filters.industries.join('/')}`)
  }
  if (context.filters.concepts?.length) {
    parts.push(`概念=${context.filters.concepts.join('/')}`)
  }
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
    summary,
  ].map(csvCell).join(','))

  return ['\uFEFF' + headers.join(','), ...lines].join('\n')
}

function parseListParam(value: string | null): string[] | undefined {
  const values = (value || '').split(',').map((item) => item.trim()).filter(Boolean)
  return values.length > 0 ? values : undefined
}

function parseNumberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseRankingFiltersFromParams(params: URLSearchParams): RankingFilters {
  const filters: RankingFilters = {}
  const industries = parseListParam(params.get('industries'))
  const concepts = parseListParam(params.get('concepts'))
  const netProfitGrowthMin = parseNumberParam(params.get('netProfitGrowthMin'))
  const revenueGrowthMin = parseNumberParam(params.get('revenueGrowthMin'))
  const roeMin = parseNumberParam(params.get('roeMin'))

  if (industries) filters.industries = industries
  if (concepts) filters.concepts = concepts
  if (netProfitGrowthMin !== undefined) filters.netProfitGrowthMin = netProfitGrowthMin
  if (revenueGrowthMin !== undefined) filters.revenueGrowthMin = revenueGrowthMin
  if (roeMin !== undefined) filters.roeMin = roeMin

  return filters
}

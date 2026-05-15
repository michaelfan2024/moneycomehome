import { describe, expect, it } from 'vitest'
import {
  buildRankingFilterSummary,
  exportRankingRowsToCsv,
  filterRankingRows,
  getRankingFilterOptions,
  parseRankingFiltersFromParams,
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
    finance: { netProfitYoy: 60, revenueYoy: 35, roe: 12 },
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
    finance: { netProfitYoy: 20, revenueYoy: 40, roe: 8 },
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
    finance: {},
  },
]

describe('filterRankingRows', () => {
  it('uses OR within industries and concepts, AND across filter families', () => {
    const filters: RankingFilters = {
      industries: ['半导体', '软件开发'],
      concepts: ['芯片'],
      netProfitGrowthMin: 50,
      revenueGrowthMin: 30,
    }

    expect(filterRankingRows(rows, filters).map((row) => row.stock_code)).toEqual(['688001'])
  })

  it('does not match rows with missing financial metrics when a metric filter is active', () => {
    expect(filterRankingRows(rows, { netProfitGrowthMin: 1 }).map((row) => row.stock_code)).toEqual([
      '688001',
      '300001',
    ])
  })
})

describe('ranking filter options and export', () => {
  it('builds unique industry and concept options from rows', () => {
    expect(getRankingFilterOptions(rows).industries).toEqual(['化学制药', '半导体', '软件开发'])
    expect(getRankingFilterOptions(rows).concepts).toEqual(['人工智能', '信创', '创新药', '芯片'])
  })

  it('exports the filtered rows with ranking and enrichment fields', () => {
    const csv = exportRankingRowsToCsv([rows[0]], {
      groupName: '每日火车股票池',
      minDays: 3,
      filters: { industries: ['半导体'], netProfitGrowthMin: 50 },
    })

    expect(csv).toContain('股票代码,股票名称,连续天数')
    expect(csv).toContain('688001,半导体A,5')
    expect(csv).toContain('半导体')
    expect(csv).toContain('净利润同比>=50%')
  })

  it('summarizes active filters for reports and export', () => {
    expect(
      buildRankingFilterSummary({
        groupName: '每日火车股票池',
        minDays: 5,
        filters: { concepts: ['芯片', '人工智能'], roeMin: 10 },
      })
    ).toContain('连续5天+')
  })
})

describe('parseRankingFiltersFromParams', () => {
  it('parses list and numeric filters from URL parameters', () => {
    const filters = parseRankingFiltersFromParams(
      new URLSearchParams('industries=半导体,软件开发&concepts=芯片&netProfitGrowthMin=50&revenueGrowthMin=30&roeMin=10')
    )

    expect(filters).toEqual({
      industries: ['半导体', '软件开发'],
      concepts: ['芯片'],
      netProfitGrowthMin: 50,
      revenueGrowthMin: 30,
      roeMin: 10,
    })
  })

  it('ignores blank lists and invalid numeric filters', () => {
    const filters = parseRankingFiltersFromParams(
      new URLSearchParams('industries=&concepts=,&netProfitGrowthMin=abc&roeMin=')
    )

    expect(filters).toEqual({})
  })
})

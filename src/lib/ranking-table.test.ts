import { describe, expect, it } from 'vitest'
import {
  filterRankingTableRows,
  formatFinanceAmount,
  formatPercent,
  sortRankingTableRows,
} from './ranking-table'
import type { EnrichedRankingResult } from '../types'

const rows: EnrichedRankingResult[] = [
  {
    id: '1',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '688001',
    stock_name: '华兴源创',
    status: 'continued',
    continuous_count: 5,
    total_appear_count: 8,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '仪器仪表',
    concepts: ['国产芯片', 'OLED'],
    finance: { reportDate: '2026-03-31', reportType: '一季报', netProfit: 120000000, netProfitYoy: 60, revenueYoy: 35, roe: 12 },
  },
  {
    id: '2',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '300001',
    stock_name: '半导体B',
    status: 'continued',
    continuous_count: 7,
    total_appear_count: 7,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '半导体',
    concepts: ['先进封装'],
    finance: { reportDate: '2026-03-31', reportType: '一季报', netProfit: 350000000, netProfitYoy: 20, revenueYoy: 40, roe: 8 },
  },
  {
    id: '3',
    batch_id: '10',
    group_id: '1',
    trade_date: '2026-05-15',
    stock_code: '600001',
    stock_name: '软件C',
    status: 'continued',
    continuous_count: 3,
    total_appear_count: 6,
    last_seen_date: '2026-05-15',
    created_at: '2026-05-15',
    industry: '软件开发',
    concepts: ['信创'],
    finance: {},
  },
]

describe('filterRankingTableRows', () => {
  it('filters by search keyword, industry OR list, and financial thresholds', () => {
    const result = filterRankingTableRows(rows, {
      search: '华兴',
      industries: ['仪器仪表', '半导体'],
      netProfitGrowthMin: 50,
      revenueGrowthMin: 30,
    })

    expect(result.map((row) => row.stock_code)).toEqual(['688001'])
  })

  it('returns rows from selected industries without requiring all industries to match', () => {
    const result = filterRankingTableRows(rows, { industries: ['仪器仪表', '软件开发'] })

    expect(result.map((row) => row.stock_code)).toEqual(['688001', '600001'])
  })
})

describe('sortRankingTableRows', () => {
  it('sorts by net profit descending without mutating source rows', () => {
    const result = sortRankingTableRows(rows, { key: 'netProfit', direction: 'desc' })

    expect(result.map((row) => row.stock_code)).toEqual(['300001', '688001', '600001'])
    expect(rows.map((row) => row.stock_code)).toEqual(['688001', '300001', '600001'])
  })

  it('places missing numeric metrics after available metrics in both directions', () => {
    expect(sortRankingTableRows(rows, { key: 'netProfitYoy', direction: 'asc' }).map((row) => row.stock_code)).toEqual([
      '300001',
      '688001',
      '600001',
    ])
    expect(sortRankingTableRows(rows, { key: 'netProfitYoy', direction: 'desc' }).map((row) => row.stock_code)).toEqual([
      '688001',
      '300001',
      '600001',
    ])
  })
})

describe('finance formatting', () => {
  it('formats net profit amount and percentages for table display', () => {
    expect(formatFinanceAmount(350000000)).toBe('3.50亿')
    expect(formatFinanceAmount(8500000)).toBe('850.00万')
    expect(formatFinanceAmount(null)).toBe('-')
    expect(formatPercent(60.1234)).toBe('60.12%')
    expect(formatPercent(undefined)).toBe('-')
  })
})

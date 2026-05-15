import { describe, expect, it } from 'vitest'
import { hasUsableFinanceSummary, normalizeFinanceEnrichmentStocks } from './finance-enrichment'

describe('normalizeFinanceEnrichmentStocks', () => {
  it('trims input, drops incomplete rows, and deduplicates by stock code', () => {
    expect(
      normalizeFinanceEnrichmentStocks([
        { stock_code: ' 688001 ', stock_name: ' 华兴源创 ' },
        { stock_code: '688001', stock_name: '重复名称' },
        { stock_code: '300001', stock_name: '半导体B' },
        { stock_code: '', stock_name: '空代码' },
        { stock_code: '600001', stock_name: '' },
      ])
    ).toEqual([
      { stock_code: '688001', stock_name: '华兴源创' },
      { stock_code: '300001', stock_name: '半导体B' },
    ])
  })
})

describe('hasUsableFinanceSummary', () => {
  it('treats a report with at least one displayed finance metric as usable', () => {
    expect(hasUsableFinanceSummary({ reportDate: '2026-03-31', netProfit: 120000000 })).toBe(true)
    expect(hasUsableFinanceSummary({ reportDate: '2026-03-31', netProfit: '120000000' as any })).toBe(true)
    expect(hasUsableFinanceSummary({ reportDate: '2026-03-31', netProfitYoy: 50 })).toBe(true)
    expect(hasUsableFinanceSummary({ reportDate: '2026-03-31' })).toBe(false)
    expect(hasUsableFinanceSummary(null)).toBe(false)
  })
})

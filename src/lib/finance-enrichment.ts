import type { EastmoneyFinanceSummary } from './eastmoney-finance'

export interface FinanceEnrichmentStock {
  stock_code: string
  stock_name: string
}

export interface FinanceEnrichmentStockInput {
  stock_code?: unknown
  stock_name?: unknown
}

export function normalizeFinanceEnrichmentStocks(stocks: FinanceEnrichmentStockInput[]): FinanceEnrichmentStock[] {
  const normalized = stocks
    .map((stock) => ({
      stock_code: String(stock.stock_code || '').trim(),
      stock_name: String(stock.stock_name || '').trim(),
    }))
    .filter((stock) => stock.stock_code && stock.stock_name)

  const byCode = new Map<string, FinanceEnrichmentStock>()
  normalized.forEach((stock) => {
    if (!byCode.has(stock.stock_code)) {
      byCode.set(stock.stock_code, stock)
    }
  })

  return Array.from(byCode.values())
}

export function hasUsableFinanceSummary(
  summary: Partial<EastmoneyFinanceSummary> | null | undefined
): boolean {
  if (!summary?.reportDate) {
    return false
  }

  const displayedMetrics: unknown[] = [
    summary.netProfit,
    summary.netProfitYoy,
    summary.revenue,
    summary.revenueYoy,
    summary.roe,
  ]

  return displayedMetrics.some((value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value)
    }
    if (typeof value === 'string' && value.trim()) {
      return Number.isFinite(Number(value))
    }
    return false
  })
}

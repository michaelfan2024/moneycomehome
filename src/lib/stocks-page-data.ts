import type { DashboardStats, StockBatch, StockCompareResult } from '../types'

export interface DashboardOverview {
  stats: DashboardStats
  batches: StockBatch[]
  totalBatchCount: number
}

export interface ComparePageData {
  batches: StockBatch[]
  selectedDate: string
  results: StockCompareResult[]
}

export function createDashboardOverview(
  stats: DashboardStats,
  batches: StockBatch[],
  recentLimit = 6
): DashboardOverview {
  return {
    stats,
    batches: batches.slice(0, recentLimit),
    totalBatchCount: batches.length
  }
}

export function resolveCompareSelectedDate(batches: StockBatch[], requestedDate?: string | null): string {
  const normalizedDate = requestedDate?.split('T')[0]
  const matchingBatch = normalizedDate
    ? batches.find((batch) => batch.batch_date.split('T')[0] === normalizedDate)
    : null

  return matchingBatch?.batch_date || batches[0]?.batch_date || ''
}

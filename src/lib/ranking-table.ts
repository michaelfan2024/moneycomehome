import type { EnrichedRankingResult, RankingFilters } from '../types'
import { filterRankingRows } from './ranking-filters'

export type RankingTableSortKey =
  | 'continuous_count'
  | 'total_appear_count'
  | 'netProfit'
  | 'netProfitYoy'
  | 'revenueYoy'
  | 'roe'

export type SortDirection = 'asc' | 'desc'

export interface RankingTableFilters extends RankingFilters {
  search?: string
}

export interface RankingTableSort {
  key: RankingTableSortKey
  direction: SortDirection
}

function normalizeSearch(value?: string): string {
  return (value || '').trim().toLowerCase()
}

function matchesSearch(row: EnrichedRankingResult, search: string): boolean {
  if (!search) return true

  return [
    row.stock_code,
    row.stock_name,
    row.industry || '',
    ...(row.concepts || []),
  ].some((value) => value.toLowerCase().includes(search))
}

export function filterRankingTableRows(
  rows: EnrichedRankingResult[],
  filters: RankingTableFilters
): EnrichedRankingResult[] {
  const search = normalizeSearch(filters.search)
  return filterRankingRows(rows, filters).filter((row) => matchesSearch(row, search))
}

function getSortValue(row: EnrichedRankingResult, key: RankingTableSortKey): number | null | undefined {
  if (key === 'continuous_count') return row.continuous_count
  if (key === 'total_appear_count') return row.total_appear_count
  if (key === 'netProfit') return row.finance?.netProfit
  if (key === 'netProfitYoy') return row.finance?.netProfitYoy
  if (key === 'revenueYoy') return row.finance?.revenueYoy
  if (key === 'roe') return row.finance?.roe
  return undefined
}

export function sortRankingTableRows(
  rows: EnrichedRankingResult[],
  sort: RankingTableSort
): EnrichedRankingResult[] {
  const direction = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sort.key)
    const rightValue = getSortValue(right, sort.key)
    const leftMissing = typeof leftValue !== 'number' || Number.isNaN(leftValue)
    const rightMissing = typeof rightValue !== 'number' || Number.isNaN(rightValue)

    if (leftMissing && rightMissing) return 0
    if (leftMissing) return 1
    if (rightMissing) return -1

    if (leftValue === rightValue) {
      return right.continuous_count - left.continuous_count
    }

    return (leftValue - rightValue) * direction
  })
}

export function formatFinanceAmount(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  const absValue = Math.abs(value)
  if (absValue >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`
  }
  if (absValue >= 10000) {
    return `${(value / 10000).toFixed(2)}万`
  }

  return value.toFixed(2)
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toFixed(2)}%`
}

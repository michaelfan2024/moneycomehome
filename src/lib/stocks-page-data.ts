import type { DashboardStats, StockBatch, StockCompareResult, StockGroup } from '../types'

export interface DashboardOverview {
  stats: DashboardStats
  batches: StockBatch[]
  totalBatchCount: number
  groups?: StockGroup[]
  selectedGroupId?: string
}

export interface ComparePageData {
  groups?: StockGroup[]
  selectedGroupId?: string
  batches: StockBatch[]
  selectedDate: string
  results: StockCompareResult[]
}

export function createDashboardOverview(
  stats: DashboardStats,
  batches: StockBatch[],
  recentLimit = 6,
  groups?: StockGroup[],
  selectedGroupId?: string
): DashboardOverview {
  return {
    stats,
    batches: batches.slice(0, recentLimit),
    totalBatchCount: batches.length,
    groups,
    selectedGroupId
  }
}

export function resolveSelectedGroupId(groups: StockGroup[], requestedGroupId?: string | null): string {
  const activeGroups = groups.filter((group) => group.is_active)
  const requestedGroup = requestedGroupId
    ? activeGroups.find((group) => String(group.id) === String(requestedGroupId))
    : null

  return requestedGroup?.id || activeGroups[0]?.id || groups[0]?.id || ''
}

export function filterBatchesByGroup(batches: StockBatch[], groupId?: string | null): StockBatch[] {
  if (!groupId) {
    return batches
  }

  return batches.filter((batch) => String(batch.group_id || '') === String(groupId))
}

export function resolveCompareSelectedDate(
  batches: StockBatch[],
  requestedDate?: string | null,
  groupId?: string | null
): string {
  const normalizedDate = requestedDate?.split('T')[0]
  const groupBatches = filterBatchesByGroup(batches, groupId)
  const matchingBatch = normalizedDate
    ? groupBatches.find((batch) => batch.batch_date.split('T')[0] === normalizedDate)
    : null

  return matchingBatch?.batch_date || groupBatches[0]?.batch_date || ''
}

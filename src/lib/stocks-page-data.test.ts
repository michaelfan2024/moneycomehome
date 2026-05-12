import { describe, expect, it } from 'vitest'
import type { DashboardStats, StockBatch } from '../types'
import { createDashboardOverview, resolveCompareSelectedDate } from './stocks-page-data'

const batches: StockBatch[] = [
  { id: '3', batch_date: '2026-05-11', file_name: 'latest.xlsx', total_count: 231, created_at: '2026-05-11T00:00:00.000Z' },
  { id: '2', batch_date: '2026-05-10', file_name: 'previous.xlsx', total_count: 210, created_at: '2026-05-10T00:00:00.000Z' },
  { id: '1', batch_date: '2026-05-09', file_name: 'old.xlsx', total_count: 200, created_at: '2026-05-09T00:00:00.000Z' }
]

describe('createDashboardOverview', () => {
  it('keeps only the recent batch rows while preserving the total batch count', () => {
    const stats: DashboardStats = {
      today_count: 231,
      today_new: 12,
      today_removed: 4,
      continuous_3d_count: 20,
      continuous_5d_count: 8
    }

    const overview = createDashboardOverview(stats, batches, 2)

    expect(overview.stats).toEqual(stats)
    expect(overview.batches.map((batch) => batch.id)).toEqual(['3', '2'])
    expect(overview.totalBatchCount).toBe(3)
  })
})

describe('resolveCompareSelectedDate', () => {
  it('uses the requested date when it exists in the batch list', () => {
    expect(resolveCompareSelectedDate(batches, '2026-05-10')).toBe('2026-05-10')
  })

  it('falls back to the latest batch date when the requested date is missing', () => {
    expect(resolveCompareSelectedDate(batches, '2026-01-01')).toBe('2026-05-11')
  })
})

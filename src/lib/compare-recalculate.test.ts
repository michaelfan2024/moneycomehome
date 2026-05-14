import { describe, expect, it } from 'vitest'
import type { StockBatch, StockPoolItem } from '../types'
import { buildCompareResultsForBatches, collectHistoricalItems } from './compare-recalculate'

const batches: StockBatch[] = [
  { id: '1', batch_date: '2026-05-01', file_name: 'a', total_count: 1, created_at: '2026-05-01T00:00:00.000Z' },
  { id: '2', batch_date: '2026-05-02', file_name: 'b', total_count: 1, created_at: '2026-05-02T00:00:00.000Z' },
  { id: '3', batch_date: '2026-05-03', file_name: 'c', total_count: 1, created_at: '2026-05-03T00:00:00.000Z' }
]

const itemsByBatchId = new Map<string, StockPoolItem[]>([
  ['1', [{ id: '11', batch_id: '1', trade_date: '2026-05-01', stock_code: '000001', stock_name: 'A', created_at: '2026-05-01T00:00:00.000Z' }]],
  ['2', [{ id: '12', batch_id: '2', trade_date: '2026-05-02', stock_code: '000002', stock_name: 'B', created_at: '2026-05-02T00:00:00.000Z' }]],
  ['3', [{ id: '13', batch_id: '3', trade_date: '2026-05-03', stock_code: '000003', stock_name: 'C', created_at: '2026-05-03T00:00:00.000Z' }]]
])

describe('collectHistoricalItems', () => {
  it('collects only the batches before the current batch', () => {
    expect(collectHistoricalItems('3', batches, itemsByBatchId).map((item) => item.stock_code)).toEqual(['000001', '000002'])
  })
})

describe('buildCompareResultsForBatches', () => {
  it('builds compare payloads without re-fetching batch items repeatedly', () => {
    const result = buildCompareResultsForBatches(batches, itemsByBatchId)

    expect(result).toHaveLength(2)
    expect(result[0].batch.id).toBe('2')
    expect(result[1].batch.id).toBe('3')
  })

  it('skips the first batch in each group and never compares across groups', () => {
    const groupedBatches: StockBatch[] = [
      { id: 'g1-1', group_id: 'g1', batch_date: '2026-05-01', file_name: 'a', total_count: 1, created_at: '2026-05-01T00:00:00.000Z' },
      { id: 'g2-1', group_id: 'g2', batch_date: '2026-05-01', file_name: 'b', total_count: 1, created_at: '2026-05-01T00:00:00.000Z' },
      { id: 'g1-2', group_id: 'g1', batch_date: '2026-05-08', file_name: 'c', total_count: 1, created_at: '2026-05-08T00:00:00.000Z' }
    ]
    const groupedItems = new Map<string, StockPoolItem[]>([
      ['g1-1', [{ id: '11', batch_id: 'g1-1', trade_date: '2026-05-01', stock_code: '000001', stock_name: 'A', created_at: '2026-05-01T00:00:00.000Z' }]],
      ['g2-1', [{ id: '12', batch_id: 'g2-1', trade_date: '2026-05-01', stock_code: '000002', stock_name: 'B', created_at: '2026-05-01T00:00:00.000Z' }]],
      ['g1-2', [{ id: '13', batch_id: 'g1-2', trade_date: '2026-05-08', stock_code: '000001', stock_name: 'A', created_at: '2026-05-08T00:00:00.000Z' }]]
    ])

    const result = buildCompareResultsForBatches(groupedBatches, groupedItems)

    expect(result).toHaveLength(1)
    expect(result[0].batch.id).toBe('g1-2')
    expect(result[0].compareResults).toEqual([
      expect.objectContaining({
        batch_id: 'g1-2',
        group_id: 'g1',
        stock_code: '000001',
        status: 'continued',
        continuous_count: 2
      })
    ])
  })

  it('resets continuity when a stock is absent from an intermediate uploaded batch', () => {
    const groupedBatches: StockBatch[] = [
      { id: 'g1-1', group_id: 'g1', batch_date: '2026-05-01', file_name: 'a', total_count: 1, created_at: '2026-05-01T00:00:00.000Z' },
      { id: 'g1-2', group_id: 'g1', batch_date: '2026-05-08', file_name: 'b', total_count: 1, created_at: '2026-05-08T00:00:00.000Z' },
      { id: 'g1-3', group_id: 'g1', batch_date: '2026-05-09', file_name: 'c', total_count: 1, created_at: '2026-05-09T00:00:00.000Z' }
    ]
    const groupedItems = new Map<string, StockPoolItem[]>([
      ['g1-1', [{ id: '11', batch_id: 'g1-1', trade_date: '2026-05-01', stock_code: '000001', stock_name: 'A', created_at: '2026-05-01T00:00:00.000Z' }]],
      ['g1-2', [{ id: '12', batch_id: 'g1-2', trade_date: '2026-05-08', stock_code: '000002', stock_name: 'B', created_at: '2026-05-08T00:00:00.000Z' }]],
      ['g1-3', [{ id: '13', batch_id: 'g1-3', trade_date: '2026-05-09', stock_code: '000001', stock_name: 'A', created_at: '2026-05-09T00:00:00.000Z' }]]
    ])

    const result = buildCompareResultsForBatches(groupedBatches, groupedItems)
    const latestCompare = result.find((item) => item.batch.id === 'g1-3')

    expect(latestCompare?.compareResults).toContainEqual(
      expect.objectContaining({
        batch_id: 'g1-3',
        group_id: 'g1',
        stock_code: '000001',
        status: 'reappeared',
        continuous_count: 1
      })
    )
  })
})

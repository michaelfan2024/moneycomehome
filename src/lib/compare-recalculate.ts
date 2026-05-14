import type { StockBatch, StockPoolItem, StockCompareResult } from '../types'
import { compareStockPools } from './comparer'

export type BatchItemsMap = Map<string, StockPoolItem[]>

export function collectHistoricalItems(
  currentBatchId: string,
  orderedBatches: StockBatch[],
  itemsByBatchId: BatchItemsMap
): StockPoolItem[] {
  const historicalItems: StockPoolItem[] = []
  const currentBatch = orderedBatches.find((batch) => batch.id === currentBatchId)
  const currentGroupId = currentBatch?.group_id

  for (const batch of orderedBatches) {
    if (batch.id === currentBatchId) {
      break
    }

    if (currentGroupId && batch.group_id !== currentGroupId) {
      continue
    }

    const items = itemsByBatchId.get(batch.id) || []
    historicalItems.push(...items)
  }

  return historicalItems
}

function getGroupKey(batch: StockBatch): string {
  return batch.group_id || '__default__'
}

export function buildCompareResultsForBatches(
  orderedBatches: StockBatch[],
  itemsByBatchId: BatchItemsMap
): Array<{ batch: StockBatch; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] }> {
  const results: Array<{ batch: StockBatch; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] }> = []
  const batchesByGroup = new Map<string, StockBatch[]>()

  for (const batch of orderedBatches) {
    const groupKey = getGroupKey(batch)
    const groupBatches = batchesByGroup.get(groupKey) || []
    groupBatches.push(batch)
    batchesByGroup.set(groupKey, groupBatches)
  }

  for (const groupBatches of batchesByGroup.values()) {
    for (let i = 1; i < groupBatches.length; i++) {
      const currentBatch = groupBatches[i]
      const previousBatch = groupBatches[i - 1]
      const currentItems = itemsByBatchId.get(currentBatch.id) || []
      const previousItems = itemsByBatchId.get(previousBatch.id) || []

      if (!currentItems.length || !previousItems.length) {
        continue
      }

      const historicalBatches = groupBatches.slice(0, i)
      const allHistoricalItems = collectHistoricalItems(currentBatch.id, groupBatches, itemsByBatchId)
      const { compareResults } = compareStockPools(currentItems, previousItems, allHistoricalItems, {
        batchId: currentBatch.id,
        groupId: currentBatch.group_id,
        historicalBatchIds: historicalBatches.map((batch) => batch.id)
      })

      results.push({ batch: currentBatch, compareResults })
    }
  }

  return results
}

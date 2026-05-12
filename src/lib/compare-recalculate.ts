import type { StockBatch, StockPoolItem, StockCompareResult } from '../types'
import { compareStockPools } from './comparer'

export type BatchItemsMap = Map<string, StockPoolItem[]>

export function collectHistoricalItems(
  currentBatchId: string,
  orderedBatches: StockBatch[],
  itemsByBatchId: BatchItemsMap
): StockPoolItem[] {
  const historicalItems: StockPoolItem[] = []

  for (const batch of orderedBatches) {
    if (batch.id === currentBatchId) {
      break
    }

    const items = itemsByBatchId.get(batch.id) || []
    historicalItems.push(...items)
  }

  return historicalItems
}

export function buildCompareResultsForBatches(
  orderedBatches: StockBatch[],
  itemsByBatchId: BatchItemsMap
): Array<{ batch: StockBatch; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] }> {
  const results: Array<{ batch: StockBatch; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] }> = []

  for (let i = 1; i < orderedBatches.length; i++) {
    const currentBatch = orderedBatches[i]
    const previousBatch = orderedBatches[i - 1]
    const currentItems = itemsByBatchId.get(currentBatch.id) || []
    const previousItems = itemsByBatchId.get(previousBatch.id) || []

    if (!currentItems.length || !previousItems.length) {
      continue
    }

    const allHistoricalItems = collectHistoricalItems(currentBatch.id, orderedBatches, itemsByBatchId)
    const { compareResults } = compareStockPools(currentItems, previousItems, allHistoricalItems)

    results.push({ batch: currentBatch, compareResults })
  }

  return results
}

import {
  createCompareResults,
  deleteCompareResultsByBatchIds,
  getAllBatches,
  getStockItemsByBatch,
  resolveGroupId
} from './db'
import { buildCompareResultsForBatches, type BatchItemsMap } from './compare-recalculate'

export async function recalculateCompareResultsForGroup(
  groupId?: string | number | null,
  fromDate?: string | null
): Promise<{ success: boolean; comparedBatchCount: number; error?: string }> {
  const resolvedGroupId = await resolveGroupId(groupId)
  if (!resolvedGroupId) {
    return { success: false, comparedBatchCount: 0, error: '股票池分组不存在' }
  }

  const batches = await getAllBatches(resolvedGroupId)
  if (!batches || batches.length < 2) {
    return { success: true, comparedBatchCount: 0 }
  }

  const sortedBatches = [...batches].sort((a, b) => new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime())
  const affectedDate = fromDate?.split('T')[0]
  const affectedBatchIds = sortedBatches
    .filter((batch) => !affectedDate || batch.batch_date.split('T')[0] >= affectedDate)
    .map((batch) => batch.id)

  await deleteCompareResultsByBatchIds(affectedBatchIds, resolvedGroupId)

  const itemsByBatchId: BatchItemsMap = new Map()
  await Promise.all(sortedBatches.map(async (batch) => {
    const items = await getStockItemsByBatch(parseInt(String(batch.id), 10))
    itemsByBatchId.set(batch.id, items || [])
  }))

  const compareJobs = buildCompareResultsForBatches(sortedBatches, itemsByBatchId)
    .filter(({ batch }) => affectedBatchIds.includes(batch.id))

  for (const { compareResults } of compareJobs) {
    await createCompareResults(compareResults)
  }

  return { success: true, comparedBatchCount: compareJobs.length }
}

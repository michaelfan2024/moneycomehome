import { NextResponse } from 'next/server'
import { ensureTables, getAllBatches, getStockItemsByBatch, deleteCompareResultsByDate, createCompareResults } from '../../../../../lib/db'
import { buildCompareResultsForBatches, type BatchItemsMap } from '../../../../../lib/compare-recalculate'

export async function POST(request: Request) {
  try {
    await ensureTables()
    
    const batches = await getAllBatches()
    console.log('Total batches found:', batches?.length || 0)
    
    if (!batches || batches.length < 2) {
      return NextResponse.json({ success: false, error: '至少需要两份数据才能进行对比' }, { status: 400 })
    }

    const sortedBatches = [...batches].sort((a, b) => new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime())
    console.log('Sorted batches:', sortedBatches.map(b => `${b.batch_date} (id: ${b.id})`))

    const itemsByBatchId: BatchItemsMap = new Map()
    const itemFetches = sortedBatches.map(async (batch) => {
      const items = await getStockItemsByBatch(parseInt(String(batch.id)))
      itemsByBatchId.set(batch.id, items || [])
    })
    await Promise.all(itemFetches)

    const compareJobs = buildCompareResultsForBatches(sortedBatches, itemsByBatchId)
    console.log(`Prepared ${compareJobs.length} compare batches`)

    for (const { batch, compareResults } of compareJobs) {
      console.log(`Processing comparison for date: ${batch.batch_date}`)
      console.log(`Compare results count: ${compareResults.length}`)

      await deleteCompareResultsByDate(batch.batch_date)
      console.log(`Deleted existing compare results for ${batch.batch_date}`)

      const createResult = await createCompareResults(compareResults)
      console.log(`Created ${createResult?.length || 0} compare results for ${batch.batch_date}`)
    }

    return NextResponse.json({ success: true, message: '对比结果重新计算完成' })
  } catch (error) {
    console.error('Recalculate error:', error)
    return NextResponse.json({ success: false, error: '重新计算失败' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { ensureTables, getAllBatches, getStockItemsByBatch, deleteCompareResultsByDate, createCompareResults } from '../../../../../lib/db'
import { compareStockPools } from '../../../../../lib/comparer'
import type { StockPoolItem } from '../../../../../types'

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
    
    for (let i = 1; i < sortedBatches.length; i++) {
      const currentBatch = sortedBatches[i]
      const previousBatch = sortedBatches[i - 1]
      
      console.log(`Processing comparison for date: ${currentBatch.batch_date}`)
      
      const [currentItems, previousItems] = await Promise.all([
        getStockItemsByBatch(parseInt(String(currentBatch.id))),
        getStockItemsByBatch(parseInt(String(previousBatch.id)))
      ])

      if (currentItems && previousItems) {
        console.log(`Current items count: ${currentItems.length}, Previous items count: ${previousItems.length}`)
        
        const allHistoricalItems: StockPoolItem[] = []
        for (const histBatch of sortedBatches) {
          if (histBatch.id !== currentBatch.id) {
            const items = await getStockItemsByBatch(parseInt(String(histBatch.id)))
            if (items) {
              allHistoricalItems.push(...items)
            }
          }
        }
        console.log(`Historical items count: ${allHistoricalItems.length}`)

        const { compareResults } = compareStockPools(
          currentItems,
          previousItems,
          allHistoricalItems
        )
        console.log(`Compare results count: ${compareResults.length}`)

        await deleteCompareResultsByDate(currentBatch.batch_date)
        console.log(`Deleted existing compare results for ${currentBatch.batch_date}`)
        
        const createResult = await createCompareResults(compareResults)
        console.log(`Created ${createResult?.length || 0} compare results for ${currentBatch.batch_date}`)
      } else {
        console.log('Skipping comparison - missing current or previous items')
      }
    }

    return NextResponse.json({ success: true, message: '对比结果重新计算完成' })
  } catch (error) {
    console.error('Recalculate error:', error)
    return NextResponse.json({ success: false, error: '重新计算失败' }, { status: 500 })
  }
}
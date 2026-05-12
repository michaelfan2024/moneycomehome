import { NextResponse } from 'next/server'
import { parseTextData, ParsedStock } from '../../../../../lib/parser'
import { 
  ensureTables,
  createBatch, 
  createStockItems, 
  deleteBatch, 
  deleteStockItemsByBatch, 
  getBatchByDate,
  getPreviousBatch,
  getAllBatches,
  getStockItemsByBatch,
  createCompareResults,
  deleteCompareResultsByDate
} from '../../../../../lib/db'
import { compareStockPools } from '../../../../../lib/comparer'
import type { StockPoolItem } from '../../../../../types'

export async function POST(request: Request) {
  try {
    const { date, text } = await request.json()

    if (!date || !text) {
      return NextResponse.json({ success: false, error: '缺少日期或数据' }, { status: 400 })
    }

    await ensureTables()

    const parsedData = parseTextData(text)

    if (parsedData.length === 0) {
      return NextResponse.json({ success: false, error: '未解析到任何股票数据' }, { status: 400 })
    }

    const existingBatch = await getBatchByDate(date)
    
    if (existingBatch) {
      await deleteStockItemsByBatch(parseInt(String(existingBatch.id)))
      await deleteCompareResultsByDate(date)
      await deleteBatch(parseInt(String(existingBatch.id)))
    }

    const batch = await createBatch(date, 'text_upload', parsedData.length)
    if (!batch) {
      throw new Error('创建批次失败')
    }

    const stockItems: Omit<StockPoolItem, 'id' | 'created_at'>[] = parsedData.map(item => ({
      batch_id: batch.id,
      trade_date: date,
      stock_code: item.stock_code,
      stock_name: item.stock_name,
      source: item.source,
      note: item.note
    }))

    await createStockItems(stockItems)

    const previousBatch = await getPreviousBatch(date)
    if (previousBatch) {
      const [currentItems, previousItems, allBatches] = await Promise.all([
        getStockItemsByBatch(parseInt(String(batch.id))),
        getStockItemsByBatch(parseInt(String(previousBatch.id))),
        getAllBatches()
      ])

      if (currentItems && previousItems && allBatches) {
        const allHistoricalItems: StockPoolItem[] = []
        for (const histBatch of allBatches) {
          if (histBatch.id !== batch.id) {
            const items = await getStockItemsByBatch(parseInt(String(histBatch.id)))
            if (items) {
              allHistoricalItems.push(...items)
            }
          }
        }

        const { compareResults } = compareStockPools(
          currentItems,
          previousItems,
          allHistoricalItems
        )

        await createCompareResults(compareResults)
      }
    }

    return NextResponse.json({ success: true, count: parsedData.length })
  } catch (error) {
    console.error('Text upload error:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}

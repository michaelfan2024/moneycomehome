import { NextResponse } from 'next/server'
import { parseExcelFile, parseCsvFile, ParsedStock } from '../../../../lib/parser'
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
} from '../../../../lib/db'
import { compareStockPools } from '../../../../lib/comparer'
import type { StockPoolItem } from '../../../../types'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const date = formData.get('date') as string
    const file = formData.get('file') as File

    if (!date || !file) {
      return NextResponse.json({ success: false, error: '缺少日期或文件' }, { status: 400 })
    }

    await ensureTables()

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    let parsedData: ParsedStock[]
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parsedData = await parseExcelFile(buffer)
    } else if (fileExtension === 'csv') {
      parsedData = await parseCsvFile(buffer)
    } else {
      return NextResponse.json({ success: false, error: '不支持的文件格式' }, { status: 400 })
    }

    const existingBatch = await getBatchByDate(date)
    
    if (existingBatch) {
      await deleteStockItemsByBatch(parseInt(String(existingBatch.id)))
      await deleteCompareResultsByDate(date)
      await deleteBatch(parseInt(String(existingBatch.id)))
    }

    const batch = await createBatch(date, file.name, parsedData.length)
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
      console.log('Found previous batch:', previousBatch)
      
      const [currentItems, previousItems, allBatches] = await Promise.all([
        getStockItemsByBatch(parseInt(String(batch.id))),
        getStockItemsByBatch(parseInt(String(previousBatch.id))),
        getAllBatches()
      ])

      if (currentItems && previousItems && allBatches) {
        console.log('Current items count:', currentItems.length)
        console.log('Previous items count:', previousItems.length)
        
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

        console.log('Compare results count:', compareResults.length)
        
        await deleteCompareResultsByDate(date)
        await createCompareResults(compareResults)
        
        console.log('Compare results created successfully')
      }
    } else {
      console.log('No previous batch found, skipping comparison')
    }

    return NextResponse.json({ success: true, count: parsedData.length })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}

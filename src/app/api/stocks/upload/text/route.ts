import { NextResponse } from 'next/server'
import { parseTextData, ParsedStock } from '../../../../../lib/parser'
import { 
  ensureTables,
  createBatch, 
  createStockItems, 
  deleteBatch, 
  deleteStockItemsByBatch, 
  getBatchByDate,
  resolveGroupId
} from '../../../../../lib/db'
import { recalculateCompareResultsForGroup } from '../../../../../lib/compare-service'
import type { StockPoolItem } from '../../../../../types'

export async function POST(request: Request) {
  try {
    const { date, text, groupId } = await request.json()

    if (!date || !text) {
      return NextResponse.json({ success: false, error: '缺少日期或数据' }, { status: 400 })
    }

    await ensureTables()
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return NextResponse.json({ success: false, error: '股票池分组不存在' }, { status: 400 })
    }

    const parsedData = parseTextData(text)

    if (parsedData.length === 0) {
      return NextResponse.json({ success: false, error: '未解析到任何股票数据' }, { status: 400 })
    }

    const existingBatch = await getBatchByDate(date, resolvedGroupId)
    
    if (existingBatch) {
      await deleteStockItemsByBatch(parseInt(String(existingBatch.id)))
      await deleteBatch(parseInt(String(existingBatch.id)))
    }

    const batch = await createBatch(date, 'text_upload', parsedData.length, resolvedGroupId)
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

    await recalculateCompareResultsForGroup(resolvedGroupId, date)

    return NextResponse.json({ success: true, count: parsedData.length })
  } catch (error) {
    console.error('Text upload error:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}

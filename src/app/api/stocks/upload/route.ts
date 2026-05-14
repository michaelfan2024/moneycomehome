import { NextResponse } from 'next/server'
import { parseExcelFile, parseCsvFile, ParsedStock } from '../../../../lib/parser'
import { 
  ensureTables,
  createBatch, 
  createStockItems, 
  deleteBatch,
  deleteStockItemsByBatch, 
  getBatchByDate,
  resolveGroupId
} from '../../../../lib/db'
import { recalculateCompareResultsForGroup } from '../../../../lib/compare-service'
import type { StockPoolItem } from '../../../../types'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const date = formData.get('date') as string
    const file = formData.get('file') as File
    const groupId = formData.get('groupId') as string | null

    if (!date || !file) {
      return NextResponse.json({ success: false, error: '缺少日期或文件' }, { status: 400 })
    }

    await ensureTables()
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return NextResponse.json({ success: false, error: '股票池分组不存在' }, { status: 400 })
    }

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

    const existingBatch = await getBatchByDate(date, resolvedGroupId)
    
    if (existingBatch) {
      await deleteStockItemsByBatch(parseInt(String(existingBatch.id)))
      await deleteBatch(parseInt(String(existingBatch.id)))
    }

    const batch = await createBatch(date, file.name, parsedData.length, resolvedGroupId)
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
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}

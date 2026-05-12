import { NextResponse } from 'next/server'
import { ensureTables, getAllBatches, getBatchByDate, deleteBatch, deleteStockItemsByBatch, deleteCompareResultsByDate } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')

    if (date) {
      const batch = await getBatchByDate(date)
      return NextResponse.json({ success: true, data: batch })
    }

    const batches = await getAllBatches()
    return NextResponse.json({ success: true, data: batches })
  } catch (error) {
    console.error('Get batches error:', error)
    return NextResponse.json({ success: false, error: '获取批次失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')

    if (!date) {
      return NextResponse.json({ success: false, error: '缺少日期参数' }, { status: 400 })
    }

    const batch = await getBatchByDate(date)
    if (!batch) {
      return NextResponse.json({ success: false, error: '批次不存在' }, { status: 404 })
    }

    await deleteStockItemsByBatch(parseInt(String(batch.id)))
    await deleteCompareResultsByDate(date)
    await deleteBatch(parseInt(String(batch.id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete batch error:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

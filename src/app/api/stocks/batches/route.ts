import { NextResponse } from 'next/server'
import { ensureTables, getAllBatches, getBatchByDate, deleteBatch, deleteStockItemsByBatch, deleteCompareResultsByDate } from '../../../../lib/db'
import { recalculateCompareResultsForGroup } from '../../../../lib/compare-service'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const groupId = url.searchParams.get('groupId')

    if (date) {
      const batch = await getBatchByDate(date, groupId)
      return NextResponse.json({ success: true, data: batch })
    }

    const batches = await getAllBatches(groupId)
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
    const groupId = url.searchParams.get('groupId')

    if (!date) {
      return NextResponse.json({ success: false, error: '缺少日期参数' }, { status: 400 })
    }

    const batch = await getBatchByDate(date, groupId)
    if (!batch) {
      return NextResponse.json({ success: false, error: '批次不存在' }, { status: 404 })
    }

    await deleteStockItemsByBatch(parseInt(String(batch.id)))
    await deleteCompareResultsByDate(date, groupId)
    await deleteBatch(parseInt(String(batch.id)))
    await recalculateCompareResultsForGroup(batch.group_id, date)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete batch error:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

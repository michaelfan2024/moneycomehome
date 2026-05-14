import { NextResponse } from 'next/server'
import { ensureTables, deleteBatch, updateBatchDate, getBatchByDate, getBatchById } from '../../../../lib/db'
import { recalculateCompareResultsForGroup } from '../../../../lib/compare-service'

export async function DELETE(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const batchId = url.searchParams.get('id')
    
    if (!batchId) {
      return NextResponse.json({ success: false, error: '缺少批次ID' }, { status: 400 })
    }

    const id = parseInt(batchId)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '无效的批次ID' }, { status: 400 })
    }

    const batch = await getBatchById(id)
    await deleteBatch(id)
    if (batch) {
      await recalculateCompareResultsForGroup(batch.group_id, batch.batch_date)
    }

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Delete batch error:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const batchId = url.searchParams.get('id')
    
    console.log('PUT request received, batchId:', batchId)
    
    if (!batchId) {
      return NextResponse.json({ success: false, error: '缺少批次ID' }, { status: 400 })
    }

    const id = parseInt(batchId)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '无效的批次ID' }, { status: 400 })
    }

    const { newDate } = await request.json()
    console.log('New date received:', newDate)
    
    if (!newDate) {
      return NextResponse.json({ success: false, error: '缺少新日期' }, { status: 400 })
    }

    const currentBatch = await getBatchById(id)
    if (!currentBatch) {
      return NextResponse.json({ success: false, error: '批次不存在' }, { status: 404 })
    }

    const existingBatch = await getBatchByDate(newDate, currentBatch.group_id)
    console.log('Existing batch for date:', existingBatch)
    
    if (existingBatch && String(existingBatch.id) !== String(id)) {
      return NextResponse.json({ success: false, error: '该日期已有数据' }, { status: 400 })
    }

    const oldDate = currentBatch.batch_date
    const result = await updateBatchDate(id, newDate)
    console.log('Update result:', result)
    const recalcFromDate = [oldDate, newDate].sort()[0]
    await recalculateCompareResultsForGroup(currentBatch.group_id, recalcFromDate)
    
    return NextResponse.json({ success: true, message: '日期更新成功' })
  } catch (error) {
    console.error('Update batch date error:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

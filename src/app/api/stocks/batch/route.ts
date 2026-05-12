import { NextResponse } from 'next/server'
import { ensureTables, deleteBatch, deleteStockItemsByBatch, deleteCompareResultsByDate, updateBatchDate, getBatchByDate } from '../../../../lib/db'

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

    await deleteStockItemsByBatch(id)
    await deleteCompareResultsByDate(new Date().toISOString().split('T')[0])
    await deleteBatch(id)

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

    const existingBatch = await getBatchByDate(newDate)
    console.log('Existing batch for date:', existingBatch)
    
    if (existingBatch && String(existingBatch.id) !== String(id)) {
      return NextResponse.json({ success: false, error: '该日期已有数据' }, { status: 400 })
    }

    const result = await updateBatchDate(id, newDate)
    console.log('Update result:', result)
    
    return NextResponse.json({ success: true, message: '日期更新成功' })
  } catch (error) {
    console.error('Update batch date error:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { getStockItemsByBatch, getLatestBatch } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const batchId = url.searchParams.get('batchId')
    const groupId = url.searchParams.get('groupId')

    if (batchId) {
      const items = await getStockItemsByBatch(parseInt(batchId))
      return NextResponse.json({ success: true, data: items })
    }

    const latestBatch = await getLatestBatch(groupId)
    if (latestBatch) {
      const items = await getStockItemsByBatch(parseInt(String(latestBatch.id)))
      return NextResponse.json({ success: true, data: items })
    }

    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    console.error('Get items error:', error)
    return NextResponse.json({ success: false, error: '获取股票列表失败' }, { status: 500 })
  }
}

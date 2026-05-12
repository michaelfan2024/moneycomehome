import { NextResponse } from 'next/server'
import { ensureTables, getStockItemsByBatch, getLatestBatch } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const batchId = url.searchParams.get('batchId')

    if (batchId) {
      const items = await getStockItemsByBatch(parseInt(batchId))
      return NextResponse.json({ success: true, data: items })
    }

    const latestBatch = await getLatestBatch()
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

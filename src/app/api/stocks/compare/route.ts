import { NextResponse } from 'next/server'
import { getCompareResultsByDate, getLatestBatch } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const groupId = url.searchParams.get('groupId')

    let targetDate = date
    if (!date) {
      const latestBatch = await getLatestBatch(groupId)
      if (latestBatch) {
        targetDate = latestBatch.batch_date
      }
    }

    if (!targetDate) {
      return NextResponse.json({ success: true, data: [] })
    }

    const normalizedDate = targetDate.split('T')[0]

    const results = await getCompareResultsByDate(normalizedDate, groupId)
    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Get compare results error:', error)
    return NextResponse.json({ success: false, error: '获取对比结果失败' }, { status: 500 })
  }
}

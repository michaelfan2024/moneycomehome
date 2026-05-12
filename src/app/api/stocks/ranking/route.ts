import { NextResponse } from 'next/server'
import { ensureTables, getContinuousRanking } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const minDays = parseInt(url.searchParams.get('minDays') || '2')

    const results = await getContinuousRanking(minDays)
    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Get ranking error:', error)
    return NextResponse.json({ success: false, error: '获取排行榜失败' }, { status: 500 })
  }
}

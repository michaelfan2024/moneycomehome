import { NextResponse } from 'next/server'
import { getEnrichedContinuousRanking } from '../../../../lib/db'
import { parseRankingFiltersFromParams } from '../../../../lib/ranking-filters'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const minDays = parseInt(url.searchParams.get('minDays') || '2')
    const groupId = url.searchParams.get('groupId')
    const filters = parseRankingFiltersFromParams(url.searchParams)

    const results = await getEnrichedContinuousRanking(minDays, groupId, filters)
    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Get ranking error:', error)
    return NextResponse.json({ success: false, error: '获取排行榜失败' }, { status: 500 })
  }
}

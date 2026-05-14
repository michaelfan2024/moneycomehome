import { NextResponse } from 'next/server'
import { ensureTables } from '../../../../../lib/db'
import { recalculateCompareResultsForGroup } from '../../../../../lib/compare-service'

export async function POST(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const groupId = url.searchParams.get('groupId')
    const result = await recalculateCompareResultsForGroup(groupId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || '重新计算失败' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: '对比结果重新计算完成', count: result.comparedBatchCount })
  } catch (error) {
    console.error('Recalculate error:', error)
    return NextResponse.json({ success: false, error: '重新计算失败' }, { status: 500 })
  }
}

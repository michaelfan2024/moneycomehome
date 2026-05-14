import { NextResponse } from 'next/server'
import { getDashboardStats } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const groupId = url.searchParams.get('groupId')
    const stats = await getDashboardStats(groupId)
    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 })
  }
}

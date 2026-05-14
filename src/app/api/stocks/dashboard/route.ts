import { NextResponse } from 'next/server'
import { getDashboardOverview } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const groupId = url.searchParams.get('groupId')
    const overview = await getDashboardOverview(6, groupId)
    return NextResponse.json({ success: true, data: overview })
  } catch (error) {
    console.error('Get dashboard overview error:', error)
    return NextResponse.json({ success: false, error: '获取仪表板数据失败' }, { status: 500 })
  }
}

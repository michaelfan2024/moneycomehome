import { NextResponse } from 'next/server'
import { getDashboardStats } from '../../../../lib/db'

export async function GET() {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 })
  }
}

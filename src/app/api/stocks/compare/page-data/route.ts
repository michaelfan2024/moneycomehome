import { NextResponse } from 'next/server'
import { getComparePageData } from '../../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const pageData = await getComparePageData(date)
    return NextResponse.json({ success: true, data: pageData })
  } catch (error) {
    console.error('Get compare page data error:', error)
    return NextResponse.json({ success: false, error: '获取每日对比数据失败' }, { status: 500 })
  }
}

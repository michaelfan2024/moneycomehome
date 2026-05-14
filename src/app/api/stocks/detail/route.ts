import { NextResponse } from 'next/server'
import { getStockDetail } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const stockCode = url.searchParams.get('code')
    const groupId = url.searchParams.get('groupId')

    if (!stockCode) {
      return NextResponse.json({ success: false, error: '缺少股票代码参数' }, { status: 400 })
    }

    const detail = await getStockDetail(stockCode, groupId)
    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    console.error('Get stock detail error:', error)
    return NextResponse.json({ success: false, error: '获取股票详情失败' }, { status: 500 })
  }
}

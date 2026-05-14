import { NextResponse } from 'next/server'
import { getStockDetail } from '../../../../lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const url = new URL(request.url)
    const groupId = url.searchParams.get('groupId')
    const detail = await getStockDetail(code, groupId)
    
    if (!detail) {
      return NextResponse.json({ success: false, error: '股票不存在' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    console.error('Get stock detail error:', error)
    return NextResponse.json({ success: false, error: '获取股票详情失败' }, { status: 500 })
  }
}

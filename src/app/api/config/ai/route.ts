import { NextResponse } from 'next/server'
import { getAIConfig, saveAIConfig, testAIConnection, type AIConfig } from '../../../../lib/config-store'

export async function GET() {
  try {
    const config = getAIConfig()
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Get AI config error:', error)
    return NextResponse.json({ success: false, error: '获取配置失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, config } = body

    if (action === 'test') {
      const result = await testAIConnection(config)
      return NextResponse.json(result)
    }

    if (action === 'save') {
      const success = saveAIConfig(config as AIConfig)
      return NextResponse.json({ success, message: success ? '保存成功' : '保存失败' })
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('AI config error:', error)
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 })
  }
}
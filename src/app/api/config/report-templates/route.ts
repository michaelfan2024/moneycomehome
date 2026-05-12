import { NextResponse } from 'next/server'
import {
  createReportTemplate,
  deleteReportTemplate,
  ensureTables,
  getReportTemplates,
  updateReportTemplate
} from '../../../../lib/db'
import { normalizeReportTemplateInput } from '../../../../lib/report-template'

export async function GET() {
  try {
    await ensureTables()
    const templates = await getReportTemplates()
    return NextResponse.json({ success: true, data: templates || [] })
  } catch (error) {
    console.error('Get report templates error:', error)
    return NextResponse.json({ success: false, error: '获取模板失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTables()
    const body = await request.json()
    const input = normalizeReportTemplateInput(body)

    if (!input) {
      return NextResponse.json({ success: false, error: '模板名称和内容不能为空' }, { status: 400 })
    }

    const template = await createReportTemplate(input)
    if (!template) {
      return NextResponse.json({ success: false, error: '保存模板失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Create report template error:', error)
    return NextResponse.json({ success: false, error: '保存模板失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTables()
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const input = normalizeReportTemplateInput(body)

    if (!id || !input) {
      return NextResponse.json({ success: false, error: '模板名称和内容不能为空' }, { status: 400 })
    }

    const template = await updateReportTemplate(id, input)
    if (!template) {
      return NextResponse.json({ success: false, error: '模板不存在或保存失败' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Update report template error:', error)
    return NextResponse.json({ success: false, error: '保存模板失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少模板ID' }, { status: 400 })
    }

    const success = await deleteReportTemplate(id)
    return NextResponse.json({ success, message: success ? '删除成功' : '模板不存在' }, { status: success ? 200 : 404 })
  } catch (error) {
    console.error('Delete report template error:', error)
    return NextResponse.json({ success: false, error: '删除模板失败' }, { status: 500 })
  }
}

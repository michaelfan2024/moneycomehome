import { NextResponse } from 'next/server'
import { getAllReports, getReport, deleteReport, updateReportPublishStatus, type Report } from '../../../lib/report-store'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (id) {
      const report = getReport(id)
      if (!report) {
        return NextResponse.json({ success: false, error: '报告不存在' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: report })
    }

    const reports = getAllReports()
    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    console.error('Get report error:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少报告ID' }, { status: 400 })
    }

    const success = deleteReport(id)
    return NextResponse.json({ success, message: success ? '删除成功' : '删除失败' })
  } catch (error) {
    console.error('Delete report error:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, action, publishedTo } = body

    if (action === 'publish' && id && publishedTo) {
      const success = await updateReportPublishStatus(id, publishedTo)
      return NextResponse.json({ success, message: success ? '更新成功' : '更新失败' })
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
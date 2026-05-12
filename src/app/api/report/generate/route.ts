import { NextResponse } from 'next/server'
import { callAIAnalysis, DEFAULT_TEMPLATE } from '../../../../lib/ai-analysis'
import { saveReport, type Report } from '../../../../lib/report-store'
import type { AnalysisTemplate } from '../../../../lib/analysis-template'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, stocks, template } = body

    if (!date || !stocks || !Array.isArray(stocks)) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 })
    }

    const stockResults = stocks.map((s: any) => ({
      id: s.id || `temp_${Date.now()}`,
      trade_date: s.trade_date || date,
      stock_code: s.stock_code,
      stock_name: s.stock_name,
      status: s.status || 'new',
      continuous_count: s.continuous_count || 1,
      total_appear_count: s.total_appear_count || 1,
      last_seen_date: s.last_seen_date,
      created_at: s.created_at || new Date().toISOString()
    }))

    const selectedTemplate: AnalysisTemplate = template || DEFAULT_TEMPLATE
    const aiResult = await callAIAnalysis(stockResults, date, selectedTemplate)

    if (!aiResult.success || !aiResult.content) {
      return NextResponse.json({ success: false, error: aiResult.error }, { status: 500 })
    }

    const report: Report = {
      id: aiResult.reportId!,
      date,
      title: `${date} 新增股票AI分析报告`,
      content: aiResult.content,
      stockCount: stockResults.length,
      createdAt: new Date().toISOString()
    }

    const saved = saveReport(report)
    if (!saved) {
      return NextResponse.json({ success: false, error: '报告保存失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.id,
        title: report.title
      }
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 })
  }
}
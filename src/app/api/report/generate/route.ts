import { NextResponse } from 'next/server'
import { callAIAnalysis, DEFAULT_TEMPLATE } from '../../../../lib/ai-analysis'
import { saveReport, type Report } from '../../../../lib/report-store'
import type { AnalysisTemplate } from '../../../../lib/analysis-template'
import { buildFinanceContext, fetchLatestEastmoneyFinanceSummary, toReportFinanceSource } from '../../../../lib/eastmoney-finance'
import { getLatestFinancialReport, upsertFinancialReport } from '../../../../lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      date,
      stocks,
      template,
      sourceType = 'compare',
      filterSummary,
      reportTitle,
    } = body

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
      created_at: s.created_at || new Date().toISOString(),
      industry: s.industry,
      concepts: s.concepts,
      finance: s.finance,
    }))

    const financeSnapshots = await Promise.all(
      stockResults.map(async (stock) => {
        const fetched = await fetchLatestEastmoneyFinanceSummary(stock.stock_code)
        if (fetched) {
          await upsertFinancialReport(fetched)
          return fetched
        }

        return await getLatestFinancialReport(stock.stock_code)
      })
    )

    const financeContext = buildFinanceContext(
      financeSnapshots.filter((item): item is NonNullable<typeof item> => Boolean(item))
    )
    const financeSources = financeSnapshots
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => toReportFinanceSource(item))

    const selectedTemplate: AnalysisTemplate = template || DEFAULT_TEMPLATE
    const normalizedSourceType = sourceType === 'ranking' ? 'ranking' : 'compare'
    const title = reportTitle || (normalizedSourceType === 'ranking'
      ? `${date} 连续榜单AI分析报告`
      : `${date} 新增股票AI分析报告`)
    const aiResult = await callAIAnalysis(stockResults, date, selectedTemplate, financeContext, {
      sourceType: normalizedSourceType,
      title,
      filterSummary,
    })

    if (!aiResult.success || !aiResult.content) {
      return NextResponse.json({ success: false, error: aiResult.error }, { status: 500 })
    }

    const report: Report = {
      id: aiResult.reportId!,
      date,
      title,
      content: aiResult.content,
      stockCount: stockResults.length,
      createdAt: new Date().toISOString(),
      sourceType: normalizedSourceType,
      filterSummary,
      financeSources
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

import { NextResponse } from 'next/server'
import { ensureTables, getLatestFinancialReport, upsertFinancialReport } from '../../../../../lib/db'
import { fetchLatestEastmoneyFinanceSummary } from '../../../../../lib/eastmoney-finance'
import {
  hasUsableFinanceSummary,
  normalizeFinanceEnrichmentStocks,
  type FinanceEnrichmentStockInput,
} from '../../../../../lib/finance-enrichment'

const FETCH_CONCURRENCY = 8

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []

  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency)
    results.push(...await Promise.all(chunk.map(worker)))
  }

  return results
}

export async function POST(request: Request) {
  try {
    await ensureTables()
    const body = await request.json()
    const stocks = Array.isArray(body.stocks) ? body.stocks as FinanceEnrichmentStockInput[] : []
    const uniqueStocks = normalizeFinanceEnrichmentStocks(stocks)

    if (uniqueStocks.length === 0) {
      return NextResponse.json({ success: false, error: '缺少股票列表' }, { status: 400 })
    }

    const cachedReports = await Promise.all(
      uniqueStocks.map(async (stock) => ({
        stock,
        report: await getLatestFinancialReport(stock.stock_code),
      }))
    )
    const cachedUsableReports = cachedReports
      .map((item) => item.report)
      .filter((report): report is NonNullable<typeof report> => hasUsableFinanceSummary(report))
    const stocksToFetch = cachedReports
      .filter((item) => !hasUsableFinanceSummary(item.report))
      .map((item) => item.stock)

    const fetchedReports = (
      await runWithConcurrency(stocksToFetch, FETCH_CONCURRENCY, async (stock) => {
        const fetched = await fetchLatestEastmoneyFinanceSummary(stock.stock_code)
        if (!fetched) {
          return null
        }

        const saved = await upsertFinancialReport(fetched)
        return saved ? fetched : null
      })
    ).filter((report): report is NonNullable<typeof report> => Boolean(report))

    return NextResponse.json({
      success: true,
      data: {
        requested: uniqueStocks.length,
        cached: cachedUsableReports.length,
        fetched: fetchedReports.length,
        failed: stocksToFetch.length - fetchedReports.length,
      },
    })
  } catch (error) {
    console.error('Finance enrichment error:', error)
    return NextResponse.json({ success: false, error: '补全财务数据失败' }, { status: 500 })
  }
}

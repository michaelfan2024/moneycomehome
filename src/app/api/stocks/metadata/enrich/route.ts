import { NextResponse } from 'next/server'
import { ensureTables, getStockMetadataByCodes, upsertStockMetadata } from '../../../../../lib/db'
import { fetchStockMetadata, isStockMetadataStale } from '../../../../../lib/stock-metadata'

interface EnrichStockInput {
  stock_code?: string
  stock_name?: string
}

export async function POST(request: Request) {
  try {
    await ensureTables()
    const body = await request.json()
    const stocks = Array.isArray(body.stocks) ? body.stocks as EnrichStockInput[] : []
    const normalizedStocks = stocks
      .map((stock) => ({
        stock_code: String(stock.stock_code || '').trim(),
        stock_name: String(stock.stock_name || '').trim(),
      }))
      .filter((stock) => stock.stock_code && stock.stock_name)

    if (normalizedStocks.length === 0) {
      return NextResponse.json({ success: false, error: '缺少股票列表' }, { status: 400 })
    }

    const uniqueStocks = Array.from(
      new Map(normalizedStocks.map((stock) => [stock.stock_code, stock])).values()
    )
    const cachedMetadata = await getStockMetadataByCodes(uniqueStocks.map((stock) => stock.stock_code))
    const cachedByCode = new Map(cachedMetadata.map((metadata) => [metadata.stock_code, metadata]))
    const stocksToFetch = uniqueStocks.filter((stock) => {
      const cached = cachedByCode.get(stock.stock_code)
      return !cached || isStockMetadataStale(cached.fetched_at)
    })

    const fetchedMetadata = (
      await Promise.all(
        stocksToFetch.map((stock) => fetchStockMetadata(stock.stock_code, stock.stock_name))
      )
    ).filter((metadata): metadata is NonNullable<typeof metadata> => Boolean(metadata))

    const savedMetadata = fetchedMetadata.length > 0
      ? await upsertStockMetadata(fetchedMetadata)
      : []
    const savedByCode = new Map((savedMetadata || []).map((metadata) => [metadata.stock_code, metadata]))
    const combinedMetadata = uniqueStocks
      .map((stock) => savedByCode.get(stock.stock_code) || cachedByCode.get(stock.stock_code))
      .filter((metadata): metadata is NonNullable<typeof metadata> => Boolean(metadata))

    return NextResponse.json({
      success: true,
      data: {
        metadata: combinedMetadata,
        requested: uniqueStocks.length,
        cached: cachedMetadata.length,
        fetched: savedMetadata?.length || 0,
        failed: stocksToFetch.length - (savedMetadata?.length || 0),
      },
    })
  } catch (error) {
    console.error('Metadata enrichment error:', error)
    return NextResponse.json({ success: false, error: '补全行业/概念失败' }, { status: 500 })
  }
}

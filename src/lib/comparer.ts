import type { StockPoolItem, StockCompareResult, StockStatus } from '../types'

export interface CompareResult {
  newStocks: StockPoolItem[]
  removedStocks: StockPoolItem[]
  continuedStocks: StockPoolItem[]
  reappearedStocks: StockPoolItem[]
}

export interface CompareStockPoolsOptions {
  batchId?: string | number
  groupId?: string | number
  historicalBatchIds?: Array<string | number>
}

export function compareStockPools(
  currentStocks: StockPoolItem[],
  previousStocks: StockPoolItem[],
  allHistoricalStocks: StockPoolItem[],
  options: CompareStockPoolsOptions = {}
): { result: CompareResult; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] } {
  const currentCodes = new Set(currentStocks.map(s => s.stock_code))
  const previousCodes = new Set(previousStocks.map(s => s.stock_code))
  const orderedHistoricalBatchIds = options.historicalBatchIds?.map(String) || []
  
  const historicalCodes = new Map<string, { batchIds: string[], dates: string[], lastDate: string }>()
  for (const stock of allHistoricalStocks) {
    if (!historicalCodes.has(stock.stock_code)) {
      historicalCodes.set(stock.stock_code, { batchIds: [], dates: [], lastDate: '' })
    }
    const entry = historicalCodes.get(stock.stock_code)!
    const batchId = String(stock.batch_id || stock.trade_date)
    if (!entry.batchIds.includes(batchId)) {
      entry.batchIds.push(batchId)
    }
    if (!entry.dates.includes(stock.trade_date)) {
      entry.dates.push(stock.trade_date)
    }
    entry.lastDate = stock.trade_date
  }
  
  const newStocks: StockPoolItem[] = []
  const removedStocks: StockPoolItem[] = []
  const continuedStocks: StockPoolItem[] = []
  const reappearedStocks: StockPoolItem[] = []
  
  const compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] = []
  
  const currentDate = currentStocks.length > 0 ? currentStocks[0].trade_date : ''
  
  const processedCodes = new Set<string>()
  
  for (const stock of currentStocks) {
    if (processedCodes.has(stock.stock_code)) {
      continue
    }
    processedCodes.add(stock.stock_code)
    
    const isInPrevious = previousCodes.has(stock.stock_code)
    const hasHistory = historicalCodes.has(stock.stock_code) && 
                      historicalCodes.get(stock.stock_code)!.dates.length > 0
    
    let status: StockStatus
    let continuousCount = 1
    let totalAppearCount = 1
    let lastSeenDate: string | undefined
    
    if (!hasHistory || historicalCodes.get(stock.stock_code)!.dates.length === 0) {
      status = 'first_seen'
      totalAppearCount = 1
    } else if (!isInPrevious) {
      status = 'reappeared'
      const history = historicalCodes.get(stock.stock_code)!
      totalAppearCount = history.batchIds.length + 1
      lastSeenDate = history.lastDate
      continuousCount = 1
    } else {
      status = 'continued'
      const history = historicalCodes.get(stock.stock_code)!
      totalAppearCount = history.batchIds.length + 1
      let count = 1

      if (orderedHistoricalBatchIds.length > 0) {
        const appearedBatchIds = new Set(history.batchIds.map(String))
        count = 0
        for (let i = orderedHistoricalBatchIds.length - 1; i >= 0; i--) {
          if (appearedBatchIds.has(orderedHistoricalBatchIds[i])) {
            count++
          } else {
            break
          }
        }
      } else {
        count = history.batchIds.length
      }

      continuousCount = count + 1
    }
    
    if (status === 'first_seen' || status === 'reappeared') {
      if (status === 'first_seen') {
        newStocks.push(stock)
      } else {
        reappearedStocks.push(stock)
      }
    } else {
      continuedStocks.push(stock)
    }
    
    compareResults.push({
      batch_id: options.batchId !== undefined ? String(options.batchId) : undefined,
      group_id: options.groupId !== undefined ? String(options.groupId) : undefined,
      trade_date: stock.trade_date,
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      status,
      continuous_count: continuousCount,
      total_appear_count: totalAppearCount,
      last_seen_date: lastSeenDate
    })
  }
  
  const removedProcessed = new Set<string>()
  for (const stock of previousStocks) {
    if (removedProcessed.has(stock.stock_code)) {
      continue
    }
    removedProcessed.add(stock.stock_code)
    
    if (!currentCodes.has(stock.stock_code)) {
      removedStocks.push(stock)
      
      const history = historicalCodes.get(stock.stock_code)
      const totalAppearCount = history ? history.batchIds.length : 1
      
      compareResults.push({
        batch_id: options.batchId !== undefined ? String(options.batchId) : undefined,
        group_id: options.groupId !== undefined ? String(options.groupId) : undefined,
        trade_date: currentDate,
        stock_code: stock.stock_code,
        stock_name: stock.stock_name,
        status: 'removed',
        continuous_count: 0,
        total_appear_count: totalAppearCount,
        last_seen_date: stock.trade_date
      })
    }
  }
  
  return {
    result: {
      newStocks,
      removedStocks,
      continuedStocks,
      reappearedStocks
    },
    compareResults
  }
}

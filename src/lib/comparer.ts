import type { StockPoolItem, StockCompareResult, StockStatus } from '../types'

export interface CompareResult {
  newStocks: StockPoolItem[]
  removedStocks: StockPoolItem[]
  continuedStocks: StockPoolItem[]
  reappearedStocks: StockPoolItem[]
}

export function compareStockPools(
  currentStocks: StockPoolItem[],
  previousStocks: StockPoolItem[],
  allHistoricalStocks: StockPoolItem[]
): { result: CompareResult; compareResults: Omit<StockCompareResult, 'id' | 'created_at'>[] } {
  const currentCodes = new Set(currentStocks.map(s => s.stock_code))
  const previousCodes = new Set(previousStocks.map(s => s.stock_code))
  
  const historicalCodes = new Map<string, { dates: string[], lastDate: string }>()
  for (const stock of allHistoricalStocks) {
    if (!historicalCodes.has(stock.stock_code)) {
      historicalCodes.set(stock.stock_code, { dates: [], lastDate: '' })
    }
    const entry = historicalCodes.get(stock.stock_code)!
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
      totalAppearCount = history.dates.length + 1
      lastSeenDate = history.lastDate
      
      const sortedDates = [...history.dates].sort()
      const lastHistDate = sortedDates[sortedDates.length - 1]
      const prevDate = new Date(lastHistDate)
      const currDate = new Date(stock.trade_date)
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        continuousCount = sortedDates.length + 1
      } else {
        continuousCount = 1
      }
    } else {
      status = 'continued'
      const history = historicalCodes.get(stock.stock_code)!
      totalAppearCount = history.dates.length + 1
      
      const sortedDates = [...history.dates].sort()
      let count = 1
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (i === sortedDates.length - 1) {
          count = 1
        } else {
          const curr = new Date(sortedDates[i + 1])
          const prev = new Date(sortedDates[i])
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays === 1) {
            count++
          } else {
            break
          }
        }
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
      const totalAppearCount = history ? history.dates.length : 1
      
      compareResults.push({
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

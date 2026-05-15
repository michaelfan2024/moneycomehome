import type { StockBatch, StockPoolItem, StockCompareResult, StockDetail, DashboardStats, StockGroup, StockMetadata, EnrichedRankingResult, RankingFilters } from '../types'
import type { ComparePageData, DashboardOverview } from './stocks-page-data'

export async function uploadStockData(date: string, file: File, groupId?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const formData = new FormData()
  formData.append('date', date)
  formData.append('file', file)
  if (groupId) {
    formData.append('groupId', groupId)
  }

  const response = await fetch('/api/stocks/upload', {
    method: 'POST',
    body: formData
  })

  return response.json()
}

export async function uploadStockDataByText(date: string, text: string, groupId?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const response = await fetch('/api/stocks/upload/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ date, text, groupId })
  })

  return response.json()
}

function withGroupParam(path: string, groupId?: string | null): string {
  if (!groupId) {
    return path
  }
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}groupId=${encodeURIComponent(groupId)}`
}

export async function getStockGroups(includeInactive: boolean = false): Promise<{ success: boolean; data: StockGroup[] | null; error?: string }> {
  const response = await fetch(`/api/stocks/groups${includeInactive ? '?includeInactive=true' : ''}`)
  return response.json()
}

export async function createStockGroup(name: string): Promise<{ success: boolean; data?: StockGroup; error?: string }> {
  const response = await fetch('/api/stocks/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  })
  return response.json()
}

export async function updateStockGroup(id: string, input: { name?: string; is_active?: boolean }): Promise<{ success: boolean; data?: StockGroup; error?: string }> {
  const response = await fetch(`/api/stocks/groups?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  })
  return response.json()
}

export async function getBatches(groupId?: string): Promise<{ success: boolean; data: StockBatch[] | null }> {
  const response = await fetch(withGroupParam('/api/stocks/batches', groupId))
  return response.json()
}

export async function getDashboardOverview(groupId?: string): Promise<{ success: boolean; data: DashboardOverview | null }> {
  const response = await fetch(withGroupParam('/api/stocks/dashboard', groupId))
  return response.json()
}

export async function getBatchByDate(date: string, groupId?: string): Promise<{ success: boolean; data: StockBatch | null }> {
  const response = await fetch(withGroupParam(`/api/stocks/batches?date=${date}`, groupId))
  return response.json()
}

export async function deleteBatch(date: string, groupId?: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(withGroupParam(`/api/stocks/batches?date=${date}`, groupId), {
    method: 'DELETE'
  })
  return response.json()
}

export async function deleteBatchById(batchId: number, groupId?: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(withGroupParam(`/api/stocks/batch?id=${batchId}`, groupId), {
    method: 'DELETE'
  })
  return response.json()
}

export async function updateBatchDate(batchId: number, newDate: string, groupId?: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(withGroupParam(`/api/stocks/batch?id=${batchId}`, groupId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newDate })
  })
  return response.json()
}

export async function recalculateCompareResults(groupId?: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(withGroupParam('/api/stocks/compare/recalculate', groupId), {
    method: 'POST'
  })
  return response.json()
}

export async function getStockItems(batchId?: number, groupId?: string): Promise<{ success: boolean; data: StockPoolItem[] | null }> {
  const url = batchId ? `/api/stocks/items?batchId=${batchId}` : '/api/stocks/items'
  const response = await fetch(withGroupParam(url, groupId))
  return response.json()
}

export async function getCompareResults(date?: string, groupId?: string): Promise<{ success: boolean; data: StockCompareResult[] | null }> {
  const url = date ? `/api/stocks/compare?date=${date}` : '/api/stocks/compare'
  const response = await fetch(withGroupParam(url, groupId))
  return response.json()
}

export async function getComparePageData(date?: string, groupId?: string): Promise<{ success: boolean; data: ComparePageData | null }> {
  const url = date ? `/api/stocks/compare/page-data?date=${encodeURIComponent(date)}` : '/api/stocks/compare/page-data'
  const response = await fetch(withGroupParam(url, groupId))
  return response.json()
}

export async function getStats(groupId?: string): Promise<{ success: boolean; data: DashboardStats | null }> {
  const response = await fetch(withGroupParam('/api/stocks/stats', groupId))
  return response.json()
}

export async function getStockDetail(stockCode: string, groupId?: string): Promise<{ success: boolean; data: StockDetail | null }> {
  const response = await fetch(withGroupParam(`/api/stocks/detail?code=${stockCode}`, groupId))
  return response.json()
}

function appendRankingFilters(params: URLSearchParams, filters?: RankingFilters): void {
  if (!filters) {
    return
  }
  if (filters.industries?.length) {
    params.set('industries', filters.industries.join(','))
  }
  if (filters.concepts?.length) {
    params.set('concepts', filters.concepts.join(','))
  }
  if (filters.netProfitGrowthMin !== undefined && filters.netProfitGrowthMin !== null) {
    params.set('netProfitGrowthMin', String(filters.netProfitGrowthMin))
  }
  if (filters.revenueGrowthMin !== undefined && filters.revenueGrowthMin !== null) {
    params.set('revenueGrowthMin', String(filters.revenueGrowthMin))
  }
  if (filters.roeMin !== undefined && filters.roeMin !== null) {
    params.set('roeMin', String(filters.roeMin))
  }
}

export async function getRanking(
  minDays: number = 2,
  groupId?: string,
  filters?: RankingFilters
): Promise<{ success: boolean; data: EnrichedRankingResult[] | null }> {
  const params = new URLSearchParams({ minDays: String(minDays) })
  appendRankingFilters(params, filters)
  const response = await fetch(withGroupParam(`/api/stocks/ranking?${params.toString()}`, groupId))
  return response.json()
}

export async function enrichStockMetadata(stocks: Array<{ stock_code: string; stock_name: string }>): Promise<{
  success: boolean
  data?: {
    metadata: StockMetadata[]
    requested: number
    cached: number
    fetched: number
    failed: number
  }
  error?: string
}> {
  const response = await fetch('/api/stocks/metadata/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stocks }),
  })
  return response.json()
}

export async function enrichStockFinance(stocks: Array<{ stock_code: string; stock_name: string }>): Promise<{
  success: boolean
  data?: {
    requested: number
    cached: number
    fetched: number
    failed: number
  }
  error?: string
}> {
  const response = await fetch('/api/stocks/finance/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stocks }),
  })
  return response.json()
}

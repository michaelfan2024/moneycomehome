import type { StockBatch, StockPoolItem, StockCompareResult, StockDetail, DashboardStats } from '../types'

export async function uploadStockData(date: string, file: File): Promise<{ success: boolean; count?: number; error?: string }> {
  const formData = new FormData()
  formData.append('date', date)
  formData.append('file', file)

  const response = await fetch('/api/stocks/upload', {
    method: 'POST',
    body: formData
  })

  return response.json()
}

export async function uploadStockDataByText(date: string, text: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const response = await fetch('/api/stocks/upload/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ date, text })
  })

  return response.json()
}

export async function getBatches(): Promise<{ success: boolean; data: StockBatch[] | null }> {
  const response = await fetch('/api/stocks/batches')
  return response.json()
}

export async function getBatchByDate(date: string): Promise<{ success: boolean; data: StockBatch | null }> {
  const response = await fetch(`/api/stocks/batches?date=${date}`)
  return response.json()
}

export async function deleteBatch(date: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/stocks/batches?date=${date}`, {
    method: 'DELETE'
  })
  return response.json()
}

export async function deleteBatchById(batchId: number): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/stocks/batch?id=${batchId}`, {
    method: 'DELETE'
  })
  return response.json()
}

export async function updateBatchDate(batchId: number, newDate: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/stocks/batch?id=${batchId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newDate })
  })
  return response.json()
}

export async function recalculateCompareResults(): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/stocks/compare/recalculate', {
    method: 'POST'
  })
  return response.json()
}

export async function getStockItems(batchId?: number): Promise<{ success: boolean; data: StockPoolItem[] | null }> {
  const url = batchId ? `/api/stocks/items?batchId=${batchId}` : '/api/stocks/items'
  const response = await fetch(url)
  return response.json()
}

export async function getCompareResults(date?: string): Promise<{ success: boolean; data: StockCompareResult[] | null }> {
  const url = date ? `/api/stocks/compare?date=${date}` : '/api/stocks/compare'
  const response = await fetch(url)
  return response.json()
}

export async function getStats(): Promise<{ success: boolean; data: DashboardStats | null }> {
  const response = await fetch('/api/stocks/stats')
  return response.json()
}

export async function getStockDetail(stockCode: string): Promise<{ success: boolean; data: StockDetail | null }> {
  const response = await fetch(`/api/stocks/detail?code=${stockCode}`)
  return response.json()
}

export async function getRanking(minDays: number = 2): Promise<{ success: boolean; data: StockCompareResult[] | null }> {
  const response = await fetch(`/api/stocks/ranking?minDays=${minDays}`)
  return response.json()
}

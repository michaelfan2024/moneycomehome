'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import StockTable from '../../components/StockTable'
import { getComparePageData, getCompareResults } from '../../lib/api'
import type { StockBatch, StockCompareResult, StockStatus } from '../../types'

function exportToCSV(data: StockCompareResult[]) {
  const headers = ['股票代码', '股票名称', '状态', '连续天数', '总出现次数']
  const statusLabels: Record<string, string> = {
    'first_seen': '首次出现',
    'new': '新增',
    'continued': '继续存在',
    'removed': '剔除',
    'reappeared': '重新出现',
  }
  
  const rows = data.map(item => [
    item.stock_code,
    item.stock_name,
    statusLabels[item.status] || item.status,
    item.continuous_count + '天',
    item.total_appear_count + '次'
  ])
  
  const csvContent = [headers, ...rows].map(row => 
    row.map(cell => {
      if (typeof cell === 'string' && cell.includes(',')) {
        return `"${cell}"`
      }
      return cell
    }).join(',')
  ).join('\n')
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `stock_filter_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [batches, setBatches] = useState<StockBatch[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [compareResults, setCompareResults] = useState<StockCompareResult[]>([])
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const requestedDate = searchParams.get('date') || undefined
  const requestedFilter = searchParams.get('filter')

  const isNewStockFilter = statusFilter === 'new' || statusFilter === 'first_seen'

  useEffect(() => {
    const fetchInitialPageData = async () => {
      setLoading(true)
      try {
        const result = await getComparePageData(requestedDate)
        const data = result.data
        setBatches(data?.batches || [])
        setSelectedDate(data?.selectedDate || '')
        setCompareResults(data?.results || [])
      } catch (error) {
        console.error('Error fetching compare page data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialPageData()
  }, [requestedDate])

  useEffect(() => {
    if (requestedFilter) {
      const validFilters: (StockStatus | 'all')[] = ['all', 'first_seen', 'new', 'continued', 'removed', 'reappeared']
      if (validFilters.includes(requestedFilter as StockStatus | 'all')) {
        setStatusFilter(requestedFilter as StockStatus | 'all')
      }
    }
  }, [requestedFilter])

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    setLoading(true)
    try {
      const result = await getCompareResults(date)
      setCompareResults(result.data || [])
    } catch (error) {
      console.error('Error fetching compare results:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const statusMap: Record<string, string[]> = {
      'all': ['first_seen', 'new', 'continued', 'removed', 'reappeared'],
      'new': ['first_seen', 'reappeared'],
      'first_seen': ['first_seen'],
      'reappeared': ['reappeared'],
      'continued': ['continued'],
      'removed': ['removed'],
    }

    const targetStatuses = statusMap[statusFilter] || ['all']

    return compareResults.filter((result) => {
      const matchesStatus = statusFilter === 'all' || targetStatuses.includes(result.status)
      const matchesSearch =
        normalizedQuery === '' ||
        result.stock_code.toLowerCase().includes(normalizedQuery) ||
        result.stock_name.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesSearch
    })
  }, [compareResults, searchQuery, statusFilter])

  const statusOptions: { value: StockStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'first_seen', label: '首次出现' },
    { value: 'new', label: '新增' },
    { value: 'continued', label: '继续存在' },
    { value: 'removed', label: '剔除' },
    { value: 'reappeared', label: '重新出现' },
  ]

  const statusCounts = useMemo(() => {
    const statusMap: Record<string, string[]> = {
      'new': ['first_seen', 'reappeared'],
      'first_seen': ['first_seen'],
      'reappeared': ['reappeared'],
      'continued': ['continued'],
      'removed': ['removed'],
    }

    const counts: Record<string, number> = {
      new: 0,
      first_seen: 0,
      reappeared: 0,
      continued: 0,
      removed: 0,
      all: new Set(compareResults.map((r) => r.stock_code)).size,
    }

    for (const [status, targetStatuses] of Object.entries(statusMap)) {
      const uniqueCodes = new Set(
        compareResults
          .filter((result) => targetStatuses.includes(result.status))
          .map((result) => result.stock_code)
      )
      counts[status] = uniqueCodes.size
    }

    return counts
  }, [compareResults])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[var(--border-color)] rounded-full"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
            每日对比
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">查看每日股票池变化</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">选择日期</label>
            <select
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="select-field"
            >
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batch_date}>
                  {batch.batch_date.split('T')[0]} ({batch.total_count} 只)
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">状态筛选</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StockStatus | 'all')}
              className="select-field"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">搜索</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索股票代码或名称"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('new')}>
            <p className="text-sm text-green-400">新增</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{statusCounts.new}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('continued')}>
            <p className="text-sm text-blue-400">继续存在</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{statusCounts.continued}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('removed')}>
            <p className="text-sm text-red-400">剔除</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{statusCounts.removed}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('reappeared')}>
            <p className="text-sm text-purple-400">重新出现</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{statusCounts.reappeared}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('all')}>
            <p className="text-sm text-[var(--text-secondary)]">总计</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{statusCounts.all}</p>
          </div>
        </div>
      )}

      {filteredResults.length > 0 && (
        <div className="flex justify-end gap-3">
          {isNewStockFilter && (
            <button
              onClick={() => {
                const dateStr = selectedDate.split('T')[0]
                router.push(`/report/generate?date=${dateStr}&count=${filteredResults.length}`)
              }}
              className="px-4 py-2 bg-gradient-to-r from-[var(--primary-color)] to-red-500 text-black rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              生成AI分析报告
            </button>
          )}
          <button
            onClick={() => exportToCSV(filteredResults)}
            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导出CSV ({filteredResults.length}条)
          </button>
        </div>
      )}

      <StockTable
        data={filteredResults}
        columns={['stock_code', 'stock_name', 'status', 'continuous_count', 'total_appear_count']}
      />
    </div>
  )
}

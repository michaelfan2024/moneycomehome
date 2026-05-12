'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import StockTable from '../../components/StockTable'
import { getBatches, getCompareResults } from '../../lib/api'
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

  const isNewStockFilter = statusFilter === 'new' || statusFilter === 'first_seen'

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true)
      try {
        const result = await getBatches()
        const data = result.data || []
        setBatches(data)
        
        const urlDate = searchParams.get('date')
        if (urlDate && data.some(b => b.batch_date === urlDate)) {
          setSelectedDate(urlDate)
        } else if (data.length > 0) {
          setSelectedDate(data[0].batch_date)
        }
      } catch (error) {
        console.error('Error fetching batches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBatches()
  }, [searchParams])

  useEffect(() => {
    const urlFilter = searchParams.get('filter')
    if (urlFilter) {
      const validFilters: (StockStatus | 'all')[] = ['all', 'first_seen', 'new', 'continued', 'removed', 'reappeared']
      if (validFilters.includes(urlFilter as StockStatus | 'all')) {
        setStatusFilter(urlFilter as StockStatus | 'all')
      }
    }
  }, [searchParams])

  useEffect(() => {
    const fetchCompareResults = async () => {
      if (!selectedDate) return
      setLoading(true)
      try {
        const result = await getCompareResults(selectedDate)
        setCompareResults(result.data || [])
      } catch (error) {
        console.error('Error fetching compare results:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompareResults()
  }, [selectedDate])

  const filteredResults = compareResults.filter((result) => {
    const statusMap: Record<string, string[]> = {
      'all': ['first_seen', 'new', 'continued', 'removed', 'reappeared'],
      'new': ['first_seen', 'reappeared'],
      'first_seen': ['first_seen'],
      'reappeared': ['reappeared'],
      'continued': ['continued'],
      'removed': ['removed'],
    }
    
    const targetStatuses = statusMap[statusFilter] || ['all']
    const matchesStatus = statusFilter === 'all' || targetStatuses.includes(result.status)
    const matchesSearch =
      searchQuery === '' ||
      result.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.stock_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const statusOptions: { value: StockStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'first_seen', label: '首次出现' },
    { value: 'new', label: '新增' },
    { value: 'continued', label: '继续存在' },
    { value: 'removed', label: '剔除' },
    { value: 'reappeared', label: '重新出现' },
  ]

  const getStatusCount = (status: StockStatus) => {
    const statusMap: Record<string, string[]> = {
      'new': ['first_seen', 'reappeared'],
      'first_seen': ['first_seen'],
      'reappeared': ['reappeared'],
      'continued': ['continued'],
      'removed': ['removed'],
    }
    
    const targetStatuses = statusMap[status] || [status]
    const filtered = compareResults.filter((r) => targetStatuses.includes(r.status))
    const uniqueCodes = new Set(filtered.map(r => r.stock_code))
    return uniqueCodes.size
  }

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
              onChange={(e) => setSelectedDate(e.target.value)}
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
            <p className="text-2xl font-bold text-[var(--text-primary)]">{getStatusCount('new')}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('continued')}>
            <p className="text-sm text-blue-400">继续存在</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{getStatusCount('continued')}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('removed')}>
            <p className="text-sm text-red-400">剔除</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{getStatusCount('removed')}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('reappeared')}>
            <p className="text-sm text-purple-400">重新出现</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{getStatusCount('reappeared')}</p>
          </div>
          <div className="stat-card cursor-pointer hover:scale-[1.02]" onClick={() => setStatusFilter('all')}>
            <p className="text-sm text-[var(--text-secondary)]">总计</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{new Set(compareResults.map(r => r.stock_code)).size}</p>
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

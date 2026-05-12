'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import StockTable from '../../components/StockTable'
import { getRanking } from '../../lib/api'
import type { StockCompareResult } from '../../types'

export default function RankingContent() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<StockCompareResult[]>([])
  const [minDays, setMinDays] = useState(2)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const urlMinDays = searchParams.get('minDays')
    if (urlMinDays) {
      const parsed = parseInt(urlMinDays, 10)
      if (!isNaN(parsed) && parsed >= 2) {
        setMinDays(parsed)
      }
    }
  }, [searchParams])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await getRanking(minDays)
        setResults(result.data || [])
      } catch (error) {
        console.error('Error fetching ranking:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [minDays])

  const minDaysOptions = [
    { value: 2, label: '2天及以上' },
    { value: 3, label: '3天及以上' },
    { value: 5, label: '5天及以上' },
    { value: 10, label: '10天及以上' },
  ]

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
            连续出现榜单
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">按连续出现天数排名</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">筛选条件</label>
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="select-field w-auto"
            >
              {minDaysOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <span className="text-sm text-[var(--text-muted)]">🏆 当前显示 {results.length} 只股票</span>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <p className="text-sm text-[var(--text-secondary)]">冠军 🥇</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{results[0]?.stock_name}</p>
            <p className="text-sm text-[var(--primary-color)]">{results[0]?.continuous_count} 天连续</p>
          </div>
          {results.length > 1 && (
            <div className="stat-card">
              <p className="text-sm text-[var(--text-secondary)]">亚军 🥈</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{results[1]?.stock_name}</p>
              <p className="text-sm text-[var(--primary-color)]">{results[1]?.continuous_count} 天连续</p>
            </div>
          )}
          {results.length > 2 && (
            <div className="stat-card">
              <p className="text-sm text-[var(--text-secondary)]">季军 🥉</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{results[2]?.stock_name}</p>
              <p className="text-sm text-[var(--primary-color)]">{results[2]?.continuous_count} 天连续</p>
            </div>
          )}
        </div>
      )}

      <StockTable
        data={results}
        columns={['stock_code', 'stock_name', 'continuous_count', 'total_appear_count']}
        showActions
      />
    </div>
  )
}

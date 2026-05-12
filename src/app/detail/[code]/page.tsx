'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getStockDetail } from '../../../lib/api'
import type { StockDetail } from '../../../types'

export default function StockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const stockCode = params.code as string
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await getStockDetail(stockCode)
        if (result.data) {
          setDetail(result.data)
          setError('')
        } else {
          setError('未找到该股票的详细信息')
        }
      } catch (error) {
        setError('获取股票详情失败')
        console.error('Error fetching stock detail:', error)
      } finally {
        setLoading(false)
      }
    }

    if (stockCode) {
      fetchData()
    }
  }, [stockCode])

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

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
          <span className="text-3xl">🔍</span>
        </div>
        <p className="text-[var(--text-muted)]">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[var(--primary-color)]/10 rounded-lg">
              <span className="font-mono text-[var(--primary-color)] font-medium">{detail?.stock_code}</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{detail?.stock_name}</h1>
          </div>
          <p className="text-[var(--text-secondary)] mt-1">股票详情</p>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-[var(--text-secondary)]">首次出现</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{detail?.first_seen_date}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--text-secondary)]">最后出现</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{detail?.last_seen_date}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--text-secondary)]">总出现次数</p>
          <p className="text-lg font-bold text-[var(--primary-color)]">{detail?.total_appear_count} 次</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--text-secondary)]">连续天数</p>
          <p className="text-lg font-bold text-[var(--primary-color)]">{detail?.current_continuous_count} 天</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">📅 历史出现日期</h2>
          <span className="text-sm text-[var(--text-muted)]">{detail?.appearance_dates.length} 次</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail?.appearance_dates.map((date, index) => (
            <span
              key={index}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                index === detail.appearance_dates.length - 1
                  ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]'
                  : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              {date}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">📊 统计信息</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-3 border-b border-[var(--border-color)]/50">
            <span className="text-[var(--text-secondary)]">首次出现日期</span>
            <span className="font-medium text-[var(--text-primary)]">{detail?.first_seen_date}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-[var(--border-color)]/50">
            <span className="text-[var(--text-secondary)]">最后出现日期</span>
            <span className="font-medium text-[var(--text-primary)]">{detail?.last_seen_date}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-[var(--border-color)]/50">
            <span className="text-[var(--text-secondary)]">总出现次数</span>
            <span className="font-medium text-[var(--primary-color)]">{detail?.total_appear_count} 次</span>
          </div>
          <div className="flex justify-between py-3 border-b border-[var(--border-color)]/50">
            <span className="text-[var(--text-secondary)]">当前连续天数</span>
            <span className="font-medium text-[var(--primary-color)]">{detail?.current_continuous_count} 天</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-[var(--text-secondary)]">中断次数</span>
            <span className="font-medium text-[var(--text-muted)]">{detail?.break_count} 次</span>
          </div>
        </div>
      </div>

      {(detail?.current_continuous_count ?? 0) >= 5 && (
        <div className="card p-4 bg-gradient-to-r from-[var(--primary-color)]/10 to-red-500/10 border-[var(--primary-color)]/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="font-medium text-[var(--text-primary)]">强势连续</p>
              <p className="text-sm text-[var(--text-secondary)]">该股票已连续 {detail?.current_continuous_count ?? 0} 天出现在股票池中</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

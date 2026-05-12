'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { StockDetail } from '../../../types'

export default function StockDetailPage() {
  const params = useParams()
  const stockCode = params.code as string
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/stock/${stockCode}`)
        const data = await res.json()
        if (data.success) {
          setDetail(data.data)
        }
      } catch (error) {
        console.error('Error fetching stock detail:', error)
      } finally {
        setLoading(false)
      }
    }

    if (stockCode) {
      fetchDetail()
    }
  }, [stockCode])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">未找到股票信息</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">股票详情</h1>
          <p className="text-gray-500 mt-1">{detail.stock_code} - {detail.stock_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">首次出现日期</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{detail.first_seen_date}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">最近出现日期</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{detail.last_seen_date}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">历史总出现次数</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{detail.total_appear_count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">当前连续出现天数</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{detail.current_continuous_count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">中断次数</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{detail.break_count}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">历史出现记录</h2>
        <div className="flex flex-wrap gap-2">
          {detail.appearance_dates.map((date) => (
            <span
              key={date}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              {date}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

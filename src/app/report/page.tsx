'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Report {
  id: string
  date: string
  title: string
  content: string
  stockCount: number
  createdAt: string
  publishedAt?: string
  publishedTo?: string
}

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/report')
      const data = await res.json()
      if (data.success) {
        setReports(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这份报告吗？')) return

    try {
      const res = await fetch(`/api/report?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setReports(reports.filter(r => r.id !== id))
      } else {
        alert(data.message || '删除失败')
      }
    } catch (err) {
      alert('删除失败')
    }
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
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
          AI 分析报告
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">查看历史生成的分析报告</p>
      </div>

      {reports.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-[var(--text-secondary)]">暂无报告</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            在每日对比页面筛选新增股票后，点击"生成AI分析报告"
          </p>
          <button
            onClick={() => router.push('/compare')}
            className="mt-4 px-6 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
          >
            前往每日对比
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map(report => (
            <div key={report.id} className="card p-4 hover:border-[var(--primary-color)]/50 transition-colors">
              <div className="flex items-start justify-between">
                <Link href={`/report/${report.id}`} className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium hover:text-[var(--primary-color)] transition-colors">
                      {report.title}
                    </h3>
                    {report.publishedAt && (
                      <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded">
                        已发布
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                    <span>{report.stockCount}只股票</span>
                    <span>·</span>
                    <span>{new Date(report.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/report/${report.id}`}
                    className="px-3 py-1 text-sm bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded hover:bg-[var(--primary-color)]/20 transition-colors"
                  >
                    查看
                  </Link>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="px-3 py-1 text-sm border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
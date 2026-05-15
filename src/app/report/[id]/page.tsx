'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Report {
  id: string
  date: string
  title: string
  content: string
  stockCount: number
  createdAt: string
  sourceType?: 'compare' | 'ranking'
  filterSummary?: string
  publishedAt?: string
  publishedTo?: string
  financeSources?: Array<{
    stockCode: string
    stockName: string
    orgType?: string
    reportPeriod: string
    reportType: string
    reportDateName?: string
    noticeDate?: string
    updateDate?: string
    eps?: number | null
    bps?: number | null
    cashPerShare?: number | null
    roe?: number | null
    revenueYoy?: number | null
    netProfitYoy?: number | null
    grossMargin?: number | null
    revenue?: number | null
    totalProfit?: number | null
    netProfit?: number | null
    sourceUrl: string
  }>
}

export default function ReportViewPage() {
  const router = useRouter()
  const params = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchReport(params.id as string)
    }
  }, [params.id])

  const fetchReport = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/report?id=${id}`)
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error || '报告不存在')
      }
    } catch (err) {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!report) return
    navigator.clipboard.writeText(report.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportMarkdown = () => {
    if (!report) return
    const blob = new Blob(['\uFEFF' + report.content], { type: 'text/markdown;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${report.title}.md`
    link.click()
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

  if (error || !report) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{error || '报告不存在'}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-6 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
              AI 分析报告
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {report.date} · {report.stockCount}只{report.sourceType === 'ranking' ? '榜单' : '新增'}股票
            </p>
            {report.filterSummary && (
              <p className="text-[var(--text-muted)] text-xs mt-1">{report.filterSummary}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已复制
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制全文
              </>
            )}
          </button>
          <button
            onClick={handleExportMarkdown}
            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出Markdown
          </button>
          <div className="relative">
            <button
              onClick={() => router.push(`/wechat-editor?reportId=${encodeURIComponent(report.id)}`)}
              className="px-4 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] rounded-lg hover:bg-[var(--primary-color)]/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              进入公众号排版
            </button>
          </div>
        </div>
      </div>

      {report.publishedAt && (
        <div className="card p-4 bg-green-500/10 border border-green-500/30">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>已发布至公众号 · {new Date(report.publishedAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>
      )}

      <div className="card p-8">
        <article className="prose prose-invert max-w-none">
          <div className="text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {report.content}
          </div>
        </article>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">财报来源</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            本报告引用的东方财富公开财报数据，优先使用已发布最新一期。
          </p>
        </div>

        {report.financeSources && report.financeSources.length > 0 ? (
          <div className="grid gap-4">
            {report.financeSources.map((source) => (
              <div key={`${source.stockCode}-${source.reportPeriod}`} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {source.stockName} <span className="text-[var(--text-secondary)]">{source.stockCode}</span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {source.orgType ? `${source.orgType} · ` : ''}
                      {source.reportPeriod}
                      {source.reportType ? ` · ${source.reportType}` : ''}
                    </div>
                  </div>
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--primary-color)] hover:underline"
                  >
                    查看原始数据
                  </a>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                  <div>公告日期：{source.noticeDate || '未知'}</div>
                  <div>更新日期：{source.updateDate || '未知'}</div>
                  <div>营收：{source.revenue ?? '未知'}</div>
                  <div>营收同比：{source.revenueYoy ?? '未知'}%</div>
                  <div>净利润：{source.netProfit ?? '未知'}</div>
                  <div>净利润同比：{source.netProfitYoy ?? '未知'}%</div>
                  <div>ROE：{source.roe ?? '未知'}%</div>
                  <div>基本每股收益：{source.eps ?? '未知'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            这份报告没有保存财报来源，可能是较早生成的历史报告。
          </p>
        )}
      </div>

      <div className="text-center text-sm text-[var(--text-secondary)]">
        报告生成时间：{new Date(report.createdAt).toLocaleString('zh-CN')}
      </div>
    </div>
  )
}

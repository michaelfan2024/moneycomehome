'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getCompareResults } from '../../../lib/api'
import type { StockCompareResult } from '../../../types'
import { TEMPLATES, DEFAULT_TEMPLATE, type AnalysisTemplate } from '../../../lib/analysis-template'
import { THEMES, THEME_GROUPS } from '../../../lib/wechat-editor/themes'
import { buildWechatEditorUrl, getSafeThemeId } from '../../../lib/wechat-editor/themeSelection'

export default function GenerateReportContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [stocks, setStocks] = useState<StockCompareResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<AnalysisTemplate>(DEFAULT_TEMPLATE)
  const [selectedWechatTheme, setSelectedWechatTheme] = useState(getSafeThemeId())
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [customTemplate, setCustomTemplate] = useState<AnalysisTemplate>({ ...DEFAULT_TEMPLATE })

  const date = searchParams.get('date') || ''
  const count = searchParams.get('count') || '0'
  const selectedWechatThemeDetails = THEMES.find((theme) => theme.id === selectedWechatTheme) || THEMES[0]

  useEffect(() => {
    if (!date) {
      setError('缺少日期参数')
      setLoading(false)
      return
    }
    fetchStocks()
  }, [date])

  const fetchStocks = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCompareResults(date)
      if (result.success && result.data) {
        const newStocks = result.data.filter(
          (s: StockCompareResult) => s.status === 'first_seen' || s.status === 'reappeared'
        )
        setStocks(newStocks)
      } else {
        setError('获取股票数据失败')
      }
    } catch (err) {
      setError('获取股票数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setProgress('正在调用AI分析...')
    try {
      setProgress('正在生成分析报告（预计30秒）...')
      const templateToUse = selectedTemplate.id === 'custom' ? customTemplate : selectedTemplate
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, stocks, template: templateToUse })
      })
      const data = await res.json()
      if (data.success) {
        setProgress('报告生成完成！正在跳转...')
        setTimeout(() => {
          router.push(buildWechatEditorUrl(data.data.reportId, selectedWechatTheme))
        }, 1000)
      } else {
        setError(data.error || '生成失败')
        setGenerating(false)
      }
    } catch (err) {
      setError('生成失败，请重试')
      setGenerating(false)
    }
  }

  const handleSaveCustomTemplate = () => {
    setSelectedTemplate({ ...customTemplate, id: 'custom', name: '自定义模板' })
    setShowTemplateModal(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[var(--border-color)] rounded-full"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </div>
    )
  }

  if (error && !generating) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
            AI 分析报告生成
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {date} 新增股票 · 共{stocks.length}只
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h3 className="font-medium">即将开始AI分析</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              系统将调用AI大模型，对{date}新增的{stocks.length}只股票进行深度分析
            </p>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-3">报告将包含：</h4>
          <ul className="text-sm text-[var(--text-secondary)] space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              整体概览与行业分布分析
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              重点个股深度解读（行业地位、主营业务）
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              投资亮点与风险提示
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              总结与展望
            </li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">📝 选择报告模板</label>
          <div className="flex flex-wrap gap-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`px-4 py-3 rounded-lg border transition-all ${
                  selectedTemplate.id === template.id
                    ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : 'border-[var(--border-color)] hover:border-[var(--primary-color)]'
                }`}
              >
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-[var(--text-secondary)]">{template.description}</div>
              </button>
            ))}
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-4 py-3 rounded-lg border border-dashed border-[var(--border-color)] hover:border-[var(--primary-color)] transition-all"
            >
              <div className="font-medium text-sm">自定义模板</div>
              <div className="text-xs text-[var(--text-secondary)]">自己编写提示词</div>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">🎨 选择公众号排版风格</label>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <select
              value={selectedWechatTheme}
              onChange={(event) => setSelectedWechatTheme(getSafeThemeId(event.target.value))}
              className="select-field"
            >
              {THEME_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
              <div className="text-sm font-medium">{selectedWechatThemeDetails.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {selectedWechatThemeDetails.description}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            生成后会直接进入公众号排版工作台，此处只是默认样式，进入后仍可随时切换全部 Raphael Publish 主题。
          </p>
        </div>

        {selectedTemplate.id !== 'custom' && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-2">📋 当前模板预览</h4>
            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto">
              {selectedTemplate.writingStyle}
            </div>
          </div>
        )}

        {generating ? (
          <div className="text-center py-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-[var(--border-color)] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-[var(--primary-color)] font-medium">{progress}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">请稍候，不要关闭页面</p>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[var(--primary-color)] to-red-500 text-black rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              开始生成报告
            </button>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h4 className="font-medium mb-3">新增股票预览</h4>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-card)]">
              <tr className="text-left text-[var(--text-secondary)]">
                <th className="pb-2">代码</th>
                <th className="pb-2">名称</th>
                <th className="pb-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {stocks.slice(0, 10).map((stock) => (
                <tr key={stock.stock_code} className="border-t border-[var(--border-color)]/30">
                  <td className="py-2">{stock.stock_code}</td>
                  <td className="py-2">{stock.stock_name}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      stock.status === 'first_seen' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {stock.status === 'first_seen' ? '首次出现' : '重新出现'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length > 10 && (
            <p className="text-center text-sm text-[var(--text-secondary)] py-2">
              还有 {stocks.length - 10} 只股票...
            </p>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="font-medium">📝 自定义报告模板</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">角色设定</label>
                <textarea
                  value={customTemplate.role}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, role: e.target.value })}
                  className="w-full h-24 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none"
                  placeholder="输入AI的角色设定..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">核心投资理念</label>
                <textarea
                  value={customTemplate.corePrinciples}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, corePrinciples: e.target.value })}
                  className="w-full h-32 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none"
                  placeholder="输入核心投资理念声明..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">写作风格要求</label>
                <textarea
                  value={customTemplate.writingStyle}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, writingStyle: e.target.value })}
                  className="w-full h-24 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none"
                  placeholder="输入写作风格要求..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">文章结构</label>
                <textarea
                  value={customTemplate.articleStructure}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, articleStructure: e.target.value })}
                  className="w-full h-40 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none"
                  placeholder="输入文章结构模板，可用 {{DATE}} 和 {{STOCK_COUNT}} 作为变量..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">写作提示</label>
                <textarea
                  value={customTemplate.writingTips}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, writingTips: e.target.value })}
                  className="w-full h-24 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none"
                  placeholder="输入写作提示..."
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveCustomTemplate}
                className="flex-1 px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                保存并使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

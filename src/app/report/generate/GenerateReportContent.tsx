'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getCompareResults } from '../../../lib/api'
import type { StockCompareResult } from '../../../types'
import {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  buildPromptFromTemplate,
  getEditableTemplateContent,
  isSystemTemplateId,
  type AnalysisTemplate
} from '../../../lib/analysis-template'
import { reportTemplateRecordToAnalysisTemplate, type ReportTemplateRecord } from '../../../lib/report-template'
import { THEMES, THEME_GROUPS } from '../../../lib/wechat-editor/themes'
import { buildWechatEditorUrl, getSafeThemeId } from '../../../lib/wechat-editor/themeSelection'

function getSystemBaseTemplate(id: string): AnalysisTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id)
}

function mergeSavedTemplate(record: ReportTemplateRecord): AnalysisTemplate {
  const savedTemplate = reportTemplateRecordToAnalysisTemplate(record)
  const baseTemplate = getSystemBaseTemplate(savedTemplate.id)

  if (!baseTemplate) {
    return savedTemplate
  }

  return {
    ...baseTemplate,
    name: savedTemplate.name,
    customPrompt: savedTemplate.customPrompt
  }
}

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
  const [systemTemplateOverrides, setSystemTemplateOverrides] = useState<Record<string, AnalysisTemplate>>({})
  const [customTemplates, setCustomTemplates] = useState<AnalysisTemplate[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [templateViewMode, setTemplateViewMode] = useState<'edit' | 'preview'>('edit')

  const date = searchParams.get('date') || ''
  const count = searchParams.get('count') || '0'
  const selectedWechatThemeDetails = THEMES.find((theme) => theme.id === selectedWechatTheme) || THEMES[0]
  const systemTemplates = useMemo(
    () => TEMPLATES.map((template) => systemTemplateOverrides[template.id] || template),
    [systemTemplateOverrides]
  )
  const editingSystemTemplate = editingTemplateId ? isSystemTemplateId(editingTemplateId) : false
  const editingSystemTemplateHasOverride = editingTemplateId ? Boolean(systemTemplateOverrides[editingTemplateId]) : false

  useEffect(() => {
    if (!date) {
      setError('缺少日期参数')
      setLoading(false)
      return
    }
    fetchStocks()
  }, [date])

  useEffect(() => {
    fetchCustomTemplates()
  }, [])

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
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, stocks, template: selectedTemplate })
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

  const fetchCustomTemplates = async () => {
    setTemplateLoading(true)
    setTemplateError(null)
    try {
      const res = await fetch('/api/config/report-templates')
      const data = await res.json()
      if (!data.success) {
        setTemplateError(data.error || '模板加载失败')
        return
      }

      const templates: AnalysisTemplate[] = (data.data || []).map((template: ReportTemplateRecord) => mergeSavedTemplate(template))
      const nextSystemOverrides: Record<string, AnalysisTemplate> = {}
      const nextCustomTemplates: AnalysisTemplate[] = []

      templates.forEach((template) => {
        if (isSystemTemplateId(template.id)) {
          nextSystemOverrides[template.id] = template
        } else {
          nextCustomTemplates.push(template)
        }
      })

      setSystemTemplateOverrides(nextSystemOverrides)
      setCustomTemplates(nextCustomTemplates)
      setSelectedTemplate((currentTemplate) => {
        if (nextSystemOverrides[currentTemplate.id]) {
          return nextSystemOverrides[currentTemplate.id]
        }

        const customTemplate = nextCustomTemplates.find((template) => template.id === currentTemplate.id)
        return customTemplate || currentTemplate
      })
    } catch (err) {
      setTemplateError('模板加载失败')
    } finally {
      setTemplateLoading(false)
    }
  }

  const openNewTemplateModal = () => {
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateContent('')
    setTemplateViewMode('edit')
    setTemplateError(null)
    setShowTemplateModal(true)
  }

  const openEditTemplateModal = (template: AnalysisTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateName(template.name)
    setTemplateContent(getEditableTemplateContent(template))
    setTemplateViewMode('edit')
    setTemplateError(null)
    setShowTemplateModal(true)
  }

  const handleSaveCustomTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) {
      setTemplateError('模板名称和内容不能为空')
      return
    }

    setTemplateLoading(true)
    setTemplateError(null)
    try {
      const payload = editingTemplateId
        ? { id: editingTemplateId, name: templateName, content: templateContent }
        : { name: templateName, content: templateContent }
      const res = await fetch('/api/config/report-templates', {
        method: editingTemplateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (!data.success) {
        setTemplateError(data.error || '模板保存失败')
        return
      }

      const savedTemplate = mergeSavedTemplate(data.data)
      if (isSystemTemplateId(savedTemplate.id)) {
        setSystemTemplateOverrides((templates) => ({
          ...templates,
          [savedTemplate.id]: savedTemplate
        }))
      } else {
        setCustomTemplates((templates) => {
          if (editingTemplateId) {
            return templates.map((template) => template.id === savedTemplate.id ? savedTemplate : template)
          }
          return [savedTemplate, ...templates]
        })
      }
      setSelectedTemplate(savedTemplate)
      setShowTemplateModal(false)
    } catch (err) {
      setTemplateError('模板保存失败')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleDeleteCustomTemplate = async () => {
    if (!editingTemplateId) return
    const isSystemTemplate = isSystemTemplateId(editingTemplateId)
    const confirmMessage = isSystemTemplate
      ? '确定恢复这个系统模板的默认内容吗？'
      : '确定删除这个模板吗？'
    if (!window.confirm(confirmMessage)) return

    setTemplateLoading(true)
    setTemplateError(null)
    try {
      const res = await fetch(`/api/config/report-templates?id=${encodeURIComponent(editingTemplateId)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!data.success) {
        setTemplateError(data.error || data.message || '模板删除失败')
        return
      }

      if (isSystemTemplate) {
        const baseTemplate = getSystemBaseTemplate(editingTemplateId)
        setSystemTemplateOverrides((templates) => {
          const nextTemplates = { ...templates }
          delete nextTemplates[editingTemplateId]
          return nextTemplates
        })
        if (selectedTemplate.id === editingTemplateId && baseTemplate) {
          setSelectedTemplate(baseTemplate)
        }
      } else {
        setCustomTemplates((templates) => templates.filter((template) => template.id !== editingTemplateId))
      }
      if (selectedTemplate.id === editingTemplateId) {
        setSelectedTemplate(isSystemTemplate ? getSystemBaseTemplate(editingTemplateId) || DEFAULT_TEMPLATE : DEFAULT_TEMPLATE)
      }
      setShowTemplateModal(false)
    } catch (err) {
      setTemplateError('模板删除失败')
    } finally {
      setTemplateLoading(false)
    }
  }

  const selectedTemplatePreview = getEditableTemplateContent(selectedTemplate)
  const draftTemplatePreview = templateContent.trim()
    ? buildPromptFromTemplate(
        {
          id: editingTemplateId || 'draft',
          name: templateName.trim() || '未命名模板',
          description: '模板预览',
          customPrompt: templateContent
        },
        stocks,
        date || '{{DATE}}'
      )
    : ''

  const closeTemplateModal = () => {
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
            {systemTemplates.map((template) => (
              <div
                key={template.id}
                className={`flex min-w-[240px] items-stretch rounded-lg border transition-all ${
                  selectedTemplate.id === template.id
                    ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : 'border-[var(--border-color)] hover:border-[var(--primary-color)]'
                }`}
              >
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="flex-1 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{template.name}</span>
                    {systemTemplateOverrides[template.id] && (
                      <span className="rounded bg-[var(--primary-color)]/10 px-1.5 py-0.5 text-[10px] text-[var(--primary-color)]">
                        已修改
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{template.description}</div>
                </button>
                <button
                  onClick={() => openEditTemplateModal(template)}
                  className="border-l border-[var(--border-color)] px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--primary-color)]"
                >
                  编辑
                </button>
              </div>
            ))}
            {customTemplates.map((template) => (
              <div
                key={template.id}
                className={`flex min-w-[180px] items-stretch rounded-lg border transition-all ${
                  selectedTemplate.id === template.id
                    ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : 'border-[var(--border-color)] hover:border-[var(--primary-color)]'
                }`}
              >
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="flex-1 px-4 py-3 text-left"
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{template.description}</div>
                </button>
                <button
                  onClick={() => openEditTemplateModal(template)}
                  className="border-l border-[var(--border-color)] px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--primary-color)]"
                >
                  编辑
                </button>
              </div>
            ))}
            <button
              onClick={openNewTemplateModal}
              className="px-4 py-3 rounded-lg border border-dashed border-[var(--border-color)] hover:border-[var(--primary-color)] transition-all"
            >
              <div className="font-medium text-sm">新建模板</div>
              <div className="text-xs text-[var(--text-secondary)]">数据库同步</div>
            </button>
          </div>
          {templateError && !showTemplateModal && (
            <p className="mt-2 text-sm text-red-400">{templateError}</p>
          )}
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

        {selectedTemplatePreview && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-2">📋 当前模板预览</h4>
            <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap max-h-56 overflow-y-auto">
              {selectedTemplatePreview}
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
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="font-medium">📝 {editingTemplateId ? '编辑报告模板' : '新建报告模板'}</h3>
              <button
                onClick={closeTemplateModal}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">模板名称</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm"
                  placeholder="例如：D5 模板"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium">模板内容</label>
                  <div className="flex overflow-hidden rounded-lg border border-[var(--border-color)] text-xs">
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('edit')}
                      className={`px-3 py-1.5 ${
                        templateViewMode === 'edit'
                          ? 'bg-[var(--primary-color)] text-black'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('preview')}
                      className={`border-l border-[var(--border-color)] px-3 py-1.5 ${
                        templateViewMode === 'preview'
                          ? 'bg-[var(--primary-color)] text-black'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      预览
                    </button>
                  </div>
                </div>
                {templateViewMode === 'edit' ? (
                  <textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="w-full h-[420px] px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-y leading-relaxed"
                    placeholder="粘贴角色设定、写作风格、文章结构、注意事项等完整模板内容。可使用 {{DATE}} 和 {{STOCK_COUNT}}。"
                  />
                ) : (
                  <pre className="h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {draftTemplatePreview || '填写模板内容后，这里会预览实际发送给 AI 的提示词。'}
                  </pre>
                )}
              </div>
              {templateError && (
                <p className="text-sm text-red-400">{templateError}</p>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t border-[var(--border-color)]">
              {editingTemplateId && (!editingSystemTemplate || editingSystemTemplateHasOverride) && (
                <button
                  onClick={handleDeleteCustomTemplate}
                  disabled={templateLoading}
                  className="px-4 py-2 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  {editingSystemTemplate ? '恢复默认' : '删除'}
                </button>
              )}
              <button
                onClick={closeTemplateModal}
                disabled={templateLoading}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveCustomTemplate}
                disabled={templateLoading}
                className="flex-1 px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
              >
                {templateLoading ? '保存中...' : '保存并使用'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

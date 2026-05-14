'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { parseExcelFile, parseCsvFile, parseTextData, ParsedStock } from '../../lib/parser'
import { createStockGroup, getStockGroups, uploadStockData, uploadStockDataByText } from '../../lib/api'
import type { StockGroup } from '../../types'

function UploadContent() {
  const searchParams = useSearchParams()
  const requestedGroupId = searchParams.get('groupId')
  const [selectedDate, setSelectedDate] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedStock[]>([])
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [parseStatus, setParseStatus] = useState<'idle' | 'parsing' | 'success' | 'failed'>('idle')
  const [inputText, setInputText] = useState('')
  const [useTextMode, setUseTextMode] = useState(false)
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const loadGroups = useCallback(async () => {
    try {
      const result = await getStockGroups()
      const nextGroups = result.data || []
      setGroups(nextGroups)
      setSelectedGroupId((current) => current || nextGroups.find((group) => group.id === requestedGroupId)?.id || nextGroups[0]?.id || '')
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }, [requestedGroupId])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setError('')
    setParseStatus('parsing')

    try {
      const buffer = await file.arrayBuffer()
      const fileExtension = file.name.split('.').pop()?.toLowerCase()

      let data: ParsedStock[]
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        data = await parseExcelFile(Buffer.from(buffer))
      } else if (fileExtension === 'csv') {
        data = await parseCsvFile(Buffer.from(buffer))
      } else if (fileExtension === 'txt') {
        const text = Buffer.from(buffer).toString('utf-8')
        data = parseTextData(text)
      } else {
        setError('不支持的文件格式，请上传 Excel (.xlsx, .xls)、CSV 或 TXT 文件')
        setParseStatus('failed')
        return
      }

      if (data.length === 0) {
        setError('未解析到任何股票数据，请检查文件格式是否正确')
        setParseStatus('failed')
        setParsedData([])
      } else {
        setParsedData(data)
        setParseStatus('success')
      }
    } catch (err) {
      setError('文件解析失败，请检查文件格式是否正确')
      setParseStatus('failed')
      console.error('File parse error:', err)
    }
  }, [])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInputText(text)
    
    if (text.trim()) {
      setParseStatus('parsing')
      try {
        const data = parseTextData(text)
        if (data.length === 0) {
          setError('未解析到任何股票数据，请检查格式是否正确')
          setParseStatus('failed')
          setParsedData([])
        } else {
          setParsedData(data)
          setParseStatus('success')
          setError('')
        }
      } catch (err) {
        setError('解析失败，请检查格式是否正确')
        setParseStatus('failed')
        console.error('Text parse error:', err)
      }
    } else {
      setParsedData([])
      setParseStatus('idle')
      setError('')
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!selectedGroupId || !selectedDate || parsedData.length === 0) {
      setError('请选择分组、日期并上传有效数据')
      return
    }

    setIsImporting(true)
    setError('')
    setImportResult('')

    try {
      let result
      if (useTextMode) {
        result = await uploadStockDataByText(selectedDate, inputText, selectedGroupId)
      } else {
        if (!uploadedFile) {
          setError('请上传文件或使用文本粘贴功能')
          setIsImporting(false)
          return
        }
        result = await uploadStockData(selectedDate, uploadedFile, selectedGroupId)
      }
      
      if (result.success) {
        setImportResult(`成功导入 ${result.count} 只股票！`)
        setParsedData([])
        setUploadedFile(null)
        setIsPreviewing(false)
        setParseStatus('idle')
        setInputText('')
      } else {
        setError(result.error || '导入失败，请重试')
      }
    } catch (err) {
      setError('导入失败，请重试')
      console.error('Import error:', err)
    } finally {
      setIsImporting(false)
    }
  }, [selectedGroupId, selectedDate, parsedData, uploadedFile, useTextMode, inputText])

  const handleCreateGroup = useCallback(async () => {
    const name = window.prompt('请输入新分组名称')
    if (!name?.trim()) return

    const result = await createStockGroup(name.trim())
    if (result.success && result.data) {
      await loadGroups()
      setSelectedGroupId(result.data.id)
    } else {
      setError(result.error || '创建分组失败')
    }
  }, [loadGroups])

  const canSubmit = selectedGroupId && selectedDate && parsedData.length > 0 && !isImporting

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
            上传数据
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">上传股票池数据文件或直接粘贴</p>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">选择分组 *</label>
            <button
              onClick={handleCreateGroup}
              className="text-sm text-[var(--primary-color)] hover:text-[var(--primary-dark)] transition-colors"
            >
              新建分组
            </button>
          </div>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="select-field"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          {!selectedGroupId && (
            <p className="text-sm text-yellow-400 mt-2">请先创建或选择分组</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setUseTextMode(false)
              setParsedData([])
              setInputText('')
              setParseStatus('idle')
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              !useTextMode
                ? 'bg-[var(--primary-color)] text-white'
                : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            📁 上传文件
          </button>
          <button
            onClick={() => {
              setUseTextMode(true)
              setParsedData([])
              setUploadedFile(null)
              setParseStatus('idle')
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              useTextMode
                ? 'bg-[var(--primary-color)] text-white'
                : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            ✂️ 直接粘贴
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">选择日期 *</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`input-field ${!selectedDate && parsedData.length > 0 ? 'border-yellow-500/50' : ''}`}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 bg-[var(--bg-dark)] hover:bg-[var(--bg-card-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
            >
              今天
            </button>
            <button
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 1)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 bg-[var(--bg-dark)] hover:bg-[var(--bg-card-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
            >
              昨天
            </button>
            <button
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 2)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 bg-[var(--bg-dark)] hover:bg-[var(--bg-card-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
            >
              前天
            </button>
            <button
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 7)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 bg-[var(--bg-dark)] hover:bg-[var(--bg-card-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
            >
              7天前
            </button>
          </div>
          {!selectedDate && parsedData.length > 0 && (
            <p className="text-sm text-yellow-400 mt-2">⚠️ 请选择日期</p>
          )}
        </div>

        {!useTextMode && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">上传文件 *</label>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full px-4 py-8 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  parseStatus === 'parsing'
                    ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : parseStatus === 'success'
                    ? 'border-green-500/50 bg-green-500/10'
                    : parseStatus === 'failed'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-dashed border-[var(--border-color)] hover:border-[var(--primary-color)]/50 hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                {parseStatus === 'parsing' ? (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-[var(--bg-dark)] flex items-center justify-center">
                      <span className="w-6 h-6 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></span>
                    </div>
                    <p className="text-[var(--text-secondary)]">正在解析文件...</p>
                  </>
                ) : parseStatus === 'success' ? (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                    <p className="text-[var(--text-secondary)]">成功解析 {parsedData.length} 条数据</p>
                  </>
                ) : parseStatus === 'failed' ? (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-2xl">❌</span>
                    </div>
                    <p className="text-[var(--text-secondary)]">解析失败，请重新上传</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-[var(--bg-dark)] flex items-center justify-center">
                      <span className="text-2xl">📁</span>
                    </div>
                    <p className="text-[var(--text-secondary)]">
                      {uploadedFile ? uploadedFile.name : '点击或拖拽文件到此处上传'}
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">支持 Excel (.xlsx, .xls)、CSV 和 TXT 文件</p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {useTextMode && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">粘贴股票数据 *</label>
            <div className="relative">
              <textarea
                value={inputText}
                onChange={handleTextChange}
                placeholder="请粘贴股票代码和名称，支持以下格式：

格式一（代码和名称交替）：
000001
平安银行
000002
万科A
000003
ST新都

格式二（代码和名称同行）：
000001 平安银行
000002 万科A
000003 ST新都"
                className={`w-full h-48 px-4 py-3 rounded-xl border-2 resize-none transition-all duration-200 ${
                  parseStatus === 'parsing'
                    ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : parseStatus === 'success'
                    ? 'border-green-500/50 bg-green-500/10'
                    : parseStatus === 'failed'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-[var(--border-color)] focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/20'
                } bg-[var(--bg-dark)] text-[var(--text-primary)] placeholder-[var(--text-muted)]`}
              />
              {parseStatus === 'parsing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-dark)]/80 rounded-xl">
                  <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="w-4 h-4 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></span>
                    正在解析...
                  </span>
                </div>
              )}
              {parseStatus === 'success' && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2 text-green-400 text-sm">
                  <span>✅</span>
                  <span>成功解析 {parsedData.length} 条数据</span>
                </div>
              )}
            </div>
          </div>
        )}

        {parsedData.length > 0 && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                📋 数据预览 ({parsedData.length} 条)
              </h3>
              <button
                onClick={() => setIsPreviewing(!isPreviewing)}
                className="text-sm text-[var(--primary-color)] hover:text-[var(--primary-dark)] transition-colors"
              >
                {isPreviewing ? '隐藏预览' : '显示预览'}
              </button>
            </div>

            {isPreviewing && (
              <div className="bg-[var(--bg-dark)] rounded-xl p-4 max-h-72 overflow-y-auto animate-slideUp">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="px-3 py-3 text-left font-medium">代码</th>
                      <th className="px-3 py-3 text-left font-medium">名称</th>
                      <th className="px-3 py-3 text-left font-medium">来源</th>
                      <th className="px-3 py-3 text-left font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 20).map((item, index) => (
                      <tr key={index} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card-hover)] transition-colors">
                        <td className="px-3 py-3 font-mono text-[var(--text-primary)]">{item.stock_code}</td>
                        <td className="px-3 py-3 text-[var(--text-secondary)]">{item.stock_name}</td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">{item.source || '-'}</td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">{item.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 20 && (
                  <p className="text-center text-[var(--text-muted)] mt-3 py-2">仅显示前 20 条...</p>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {importResult && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 flex items-center gap-3">
            <span className="text-lg">✅</span>
            <span>{importResult}</span>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!canSubmit}
          className={`w-full py-3.5 px-4 font-medium rounded-xl transition-all duration-200 transform ${
            canSubmit
              ? 'bg-gradient-to-r from-[var(--primary-color)] to-red-600 text-white hover:from-[var(--primary-dark)] hover:to-red-700 focus:ring-2 focus:ring-[var(--primary-color)]/50 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-[var(--bg-dark)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-color)]'
          }`}
        >
          {isImporting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              导入中...
            </span>
          ) : canSubmit ? (
            '确认导入'
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>📝</span>
              {!selectedGroupId ? '请先选择分组' : !selectedDate ? '请先选择日期' : parsedData.length === 0 ? '请先上传有效数据文件' : '准备导入'}
            </span>
          )}
        </button>
      </div>

      <div className="card p-4">
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">📝 上传说明</h4>
        <ul className="text-sm text-[var(--text-muted)] space-y-1">
          <li>• 支持 Excel (.xlsx, .xls)、CSV 和 TXT 文件格式</li>
          <li>• 文件需包含股票代码和名称列（列名包含"代码"、"名称"关键词即可）</li>
          <li>• TXT 文件请使用"代码+名称"交替格式，每行一个</li>
          <li>• 同一分组同一日期多次上传将覆盖原有数据</li>
          <li>• 系统会自动在当前分组内对比每日股票池变化</li>
        </ul>
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <UploadContent />
    </Suspense>
  )
}
